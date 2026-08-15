# ReachInbox Email Scheduler

ReachInbox is a TypeScript email scheduling assignment: a React dashboard creates individual delayed BullMQ jobs, PostgreSQL stores the source of truth, Redis persists queue state and distributed controls, and a separate worker sends through Ethereal SMTP.

## Architecture

```text
React + Tailwind (Vite)
        │ REST + session cookie
        ▼
Express API ───── PostgreSQL (users, senders, emails, attachments, sessions)
        │
        ▼
Redis AOF ─── BullMQ delayed email jobs + atomic sender throttles
        │
        ▼
Separate BullMQ worker ─── Nodemailer ─── Ethereal SMTP
```

For an in-depth design discussion, see [System Design (HLD + LLD)](docs/SYSTEM_DESIGN)

The frontend includes a landing page, light/dark shadcn-style UI primitives, Google-only login, a protected Scheduled/Sent dashboard, email detail screen, compose screen, recipient chips, CSV/TXT import, persistent file attachments, TipTap editing, scheduling picker, and sign-out. Scheduled mail is displayed as expandable batch summaries so an evaluator can see recipient count, sent/active progress, sender alias → internal Ethereal address, effective send gap, and per-sender hourly cap before opening the individual recipient emails.

## Technology stack

| Area        | Implementation                                                                           |
| ----------- | ---------------------------------------------------------------------------------------- |
| Backend     | TypeScript, Express 5, Prisma, Passport Google OAuth, express-session, connect-pg-simple |
| Scheduling  | BullMQ delayed jobs, ioredis Lua scripts, separate configurable-concurrency worker       |
| Persistence | PostgreSQL 16, Redis 7 with AOF and Docker volumes                                       |
| Email       | Nodemailer + per-sender Ethereal SMTP accounts                                           |
| Frontend    | React 18, Vite, TypeScript, Tailwind 3, shadcn-style components, TipTap, Papa Parse      |

## Setup

Prerequisites: Node 18+, Docker Desktop, and a Google Cloud OAuth client.

```bash
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler"
cd backend && npm install
cd ../frontend && npm install
```

### Configure Google OAuth

1. In Google Cloud Console, configure the OAuth consent screen and add your account as a test user if needed.
2. Create an **OAuth client ID** of type **Web application**.
3. Add this exact redirect URI:

   `http://localhost:3000/api/auth/google/callback`

4. Copy the environment template and set the credentials. Credentials belong only in the backend.

```bash
cd backend
cp .env.example .env
```

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
SESSION_SECRET="replace-with-openssl-rand-hex-32"
```

Do **not** put the Google client secret or Ethereal SMTP credentials in `frontend/.env`.

### Start infrastructure and migrate

```bash
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler"
docker compose up -d
cd backend
npx prisma migrate deploy
```

This workspace already had other containers using host ports `5432` and `6379`. To leave them untouched, this project exposes its containers on `5433` and `6380`; the checked-in backend template matches those ports. Internally, PostgreSQL and Redis remain on their standard ports.

### Run the application

```bash
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler"
npm run dev
```

Open `http://localhost:5173`, then select **Login with Google**. The authentication callback upserts the user, creates a PostgreSQL-backed session, creates a default disposable Ethereal sender on first login, and redirects to `/scheduled`.

### Run backend, worker, and frontend separately

Keep Docker infrastructure running first:

```bash
docker compose up -d
```

Then use three terminals when you want to inspect each process independently:

```bash
# Terminal 1 — Express API
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler/backend"
npm run dev:api
```

```bash
# Terminal 2 — BullMQ email worker
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler/backend"
npm run dev:worker
```

```bash
# Terminal 3 — React/Vite frontend
cd "/Users/tarunshetty/Desktop/ReachInbox Email Scheduler/frontend"
npm run dev
```

`npm run dev` from the repository root starts all three application processes together using `concurrently`.

### Ethereal Email setup

No Ethereal username or password belongs in the frontend or needs to be manually added to `.env` for the normal assignment flow.

1. On a user's first Google login, the backend creates a disposable Ethereal test account and stores it as that user's protected default sender.
2. Choosing **New sender** creates another fresh Ethereal account, optionally mapped to a clean display alias such as `tarun@eternalmail.io`.
3. SMTP credentials are stored only in PostgreSQL for this disposable assignment environment and are never returned by an API response.
4. After delivery, open the email detail view and use the stored Ethereal preview URL to inspect the rendered message.

The infrastructure and OAuth variables are configured in `backend/.env`:

```env
DATABASE_URL="postgresql://reachinbox:reachinbox@127.0.0.1:5433/reachinbox?schema=public"
REDIS_URL="redis://127.0.0.1:6380"
PORT=3000
FRONTEND_URL="http://localhost:5173"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
SESSION_SECRET="replace-with-openssl-rand-hex-32"
WORKER_CONCURRENCY=3
MIN_DELAY_MS=2000
HOURLY_LIMIT=50
```

Copy the tracked template rather than committing real secrets:

```bash
cd backend
cp .env.example .env
```

### Attachments

The paperclip in Compose now uploads up to five files, each up to 25 MB. Files are stored once in PostgreSQL and linked to each email in the scheduled batch, so they survive API/worker restarts. Images and videos have a persistent inline preview in email detail; other files are available to download. Every linked file is added to the corresponding Ethereal message through Nodemailer.

## Scheduler behavior

`POST /api/emails/schedule` validates and normalizes recipients, calculates initial intended timestamps, bulk-inserts `emails` rows, then adds individual delayed jobs using `jobId = email-{emailId}`. Jobs are enqueued in chunks of 100 so a 1000+ recipient request does not create a large `Promise.all` burst.

Initial timestamps account for `scheduledAt`, delay between emails, and the sender's hourly limit. They are an initial plan only: worker-side controls are authoritative at send time.

### Canonical sender-level policy

Each sender owns one configurable `hourlyLimit` (default: `HOURLY_LIMIT`, 50). The Compose form displays that setting and saving a new value updates the sender policy before the batch is scheduled. All current and future batches for that sender are enforced against that one policy by the worker. The schedule endpoint rejects a legacy per-batch `hourlyLimit` value when it conflicts with the sender, so concurrent batches cannot silently establish different effective limits.

### Per-sender fixed-window hourly limit

The Redis key is:

```text
ratelimit:sender:{senderId}:{floor(timestamp / 3600000)}
```

Lua atomically reads and increments the fixed-hour counter only when it remains within that sender's configured limit. On denial, the worker moves the existing BullMQ job to delayed state at the next hour boundary, updates `scheduled_at`, and marks it `rate_limited`. It does not count as an SMTP failure and does not consume SMTP retry attempts.

### Per-sender minimum inter-email delay

The Redis key is:

```text
sendgate:sender:{senderId}
```

An atomic Lua script reads the next allowed timestamp, decides whether the job can send now, and reserves the next sender slot in the same operation. The worker uses an atomic combined script for the rate check and send gate so a job deferred by the gate does not consume an hourly send slot. The effective delay is `max(MIN_DELAY_MS, delayBetweenMs)`.

This remains correct with more than one worker process. The BullMQ worker's `WORKER_CONCURRENCY` controls parallel job execution; Redis, not a per-process limiter, is the correctness boundary.

### Redis failure policy

The worker fails closed for Redis outages. If the atomic rate-limit/send-gate operation cannot reach Redis, it **does not send SMTP mail**. It retains the same BullMQ job identity, records the email as queued with a clear error message, and moves that job to delayed state for `REDIS_UNAVAILABLE_RETRY_MS` (30 seconds by default). This avoids bypassing the sender's distributed safety controls while keeping a temporary Redis outage from becoming a permanent email failure.

## Restart persistence and reconciliation

Redis starts with `appendonly yes` and a named Docker volume. BullMQ holds future delayed jobs in that Redis instance; PostgreSQL persists the business records. On API startup, reconciliation only recreates jobs for pending/queued/rate-limited/sending rows whose `email-{id}` job is genuinely absent. It never recreates all future jobs on every start.

Both server and worker handle `SIGINT`/`SIGTERM` and close their connections cleanly.

## Features implemented

| Area                     | Implemented features                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend — authentication | Real Google OAuth, Passport, PostgreSQL-backed sessions, protected routes, user ownership checks, sign-out                                                                                  |
| Backend — scheduling     | One persistent PostgreSQL email row and BullMQ delayed job per recipient, batch IDs, bulk scheduling for 1000+ recipients, configurable worker concurrency                                  |
| Backend — reliability    | Redis AOF, PostgreSQL volumes, startup reconciliation for genuinely missing jobs, graceful shutdown, retry/backoff, practical idempotency guards                                            |
| Backend — sender safety  | Multiple Ethereal senders, protected default sender, per-sender SMTP configuration, per-sender fixed-window hourly limiting and atomic send gap                                             |
| Backend — email data     | Attachment persistence, sender/email ownership enforcement, Ethereal preview URLs, sent/error/retry state persistence                                                                       |
| Frontend — access        | Landing page, Google login, authentication guard, sign-out, light/dark theme                                                                                                                |
| Frontend — dashboard     | Scheduled and Sent batch dashboards, search, status filter, refresh/polling, pagination, loading states, empty states, email detail view                                                    |
| Frontend — compose       | Sender selection, recipient chips, manual + CSV/TXT parsing, deduplication feedback, TipTap editor, attachment previews, schedule picker, delay/hourly-limit controls, success/error toasts |

## API

| Method     | Route                           | Auth | Purpose                                       |
| ---------- | ------------------------------- | ---- | --------------------------------------------- |
| GET        | `/api/auth/google`              | No   | Begins real Google OAuth                      |
| GET        | `/api/auth/google/callback`     | No   | OAuth callback then frontend redirect         |
| POST       | `/api/auth/logout`              | Yes  | Ends Passport/PG session                      |
| GET        | `/api/users/me`                 | Yes  | Current safe user profile                     |
| GET/POST   | `/api/senders`                  | Yes  | List/create Ethereal sender accounts          |
| PATCH      | `/api/senders/:id/hourly-limit` | Yes  | Update owned sender's canonical hourly policy |
| POST       | `/api/attachments`              | Yes  | Persist up to five uploaded files             |
| GET/DELETE | `/api/attachments/:id/download` | Yes  | Download or remove an owned attachment        |
| POST       | `/api/emails/schedule`          | Yes  | Create DB records and delayed jobs            |
| GET        | `/api/emails`                   | Yes  | List/filter emails                            |
| GET        | `/api/emails/:id`               | Yes  | Read owned email detail                       |
| GET        | `/api/emails/stats`             | Yes  | Scheduled and sent counts                     |

SMTP username/password are never selected or returned by frontend API responses. They are stored for disposable Ethereal accounts only. Production credentials should be encrypted at rest and sourced from a secret manager/KMS.

Protected routes verify the Passport session, sender and attachment queries are scoped to the authenticated owner, and email list/detail/schedule access is user-scoped. `.env` files are ignored by Git. `SESSION_SECRET` is required whenever `NODE_ENV=production`; Google OAuth secrets are backend-only.

## Idempotency limitation

BullMQ uniqueness plus the terminal `sent` state and conditional database transitions prevent duplicate processing in the normal case. They do **not** provide exactly-once SMTP delivery:

```text
SMTP accepts email → process crashes before DB updates to sent → BullMQ retries → duplicate email is theoretically possible
```

This is an unavoidable at-least-once delivery window without provider-side SMTP idempotency. The application minimizes it and documents it rather than claiming exactly-once delivery.

## Assumptions, shortcuts, and trade-offs

| Category | Decision | Why / impact |
| --- | --- | --- |
| Assignment email provider | Ethereal is used as required. It captures test messages and preview URLs; it does not provide production delivery to a recipient's real inbox. | Keeps the assignment demonstrable without handling real-provider reputation, domains, or deliverability. |
| SMTP secrets | Disposable Ethereal SMTP credentials are stored in PostgreSQL and never exposed through the API. | Appropriate for test accounts; production would encrypt credentials and use a secret manager/KMS. |
| Email batches | A batch is represented by a shared `batchId` on individual `emails` rows, rather than a separate campaign service/table. | Keeps the data model and scope suitable for the 48-hour assignment while preserving per-recipient observability. |
| Delivery guarantee | Delivery is practical at-least-once, not exactly-once. | A process crash after SMTP acceptance but before the `sent` database update can theoretically produce a duplicate retry. |
| Rate limiting | The policy is a sender-level fixed hourly window, not a sliding window. | It matches the requirement and is simple to enforce atomically; a send near an hour boundary can use capacity in two adjacent windows. |
| Frontend updates | The dashboard polls persisted API data every 10 seconds. | This is simpler than WebSockets and does not participate in email scheduling; status can be up to 10 seconds behind the worker. |
| Attachments | Files are stored in PostgreSQL, capped at five files and 25 MB per file. | Easy persistence and preview for the take-home; production would use encrypted object storage, malware scanning, and retention policies. |
| Recovery scope | Startup reconciliation restores only active records whose deterministic BullMQ job is missing. | Prevents recreating every delayed job after a normal Redis restart and limits duplicate job creation. |
| Sender deletion | Every user has one PostgreSQL-protected default sender. | Custom sender deletion is intentionally not exposed as a feature in this assignment, avoiding accidental deletion of send history. |

## Verification

```bash
cd backend
npm test
npm run test:integration
npm run build

cd ../frontend
npm test
npm run build
```

Unit checks cover initial schedule calculation, fixed-hour key/boundary behavior, atomic hourly checks, atomic sender send-gate behavior, combined slot behavior, and CSV/manual recipient normalization. The opt-in integration suite uses the local PostgreSQL/Redis/BullMQ services with a deterministic mock SMTP transport to verify schedule-to-job creation, delivery-to-`sent`, rate-limit deferral, send-gate concurrency, idempotency, Redis-outage deferral, and delayed-job persistence after a fresh queue connection.

For a manual real-delivery demonstration, log in through Google, create/select an Ethereal sender, schedule a short future email, then inspect the Ethereal preview URL returned by Nodemailer. The mock SMTP integration check intentionally does not claim that a real external SMTP delivery occurred.

## Known limits before submission

- A valid Google client ID/secret still needs to be supplied locally by the project owner before the OAuth button can complete a real login.
- Ethereal credentials are intentionally disposable. Ethereal accounts/previews can expire, and it is not a production email provider.
- Attachments are limited to five files and 25 MB per file. For a real production deployment, binary files should move from PostgreSQL to encrypted object storage with malware scanning and lifecycle cleanup.
- SMTP delivery is at-least-once rather than exactly-once because of the documented post-SMTP/pre-DB-crash window.
- The integration suite covers internal pipeline behavior with mock SMTP. Full authenticated Google OAuth and live Ethereal delivery remain an interactive manual acceptance check because they require the project owner's credentials.
- Direct application code contains no cron, cron scheduling, or timer-based email scheduler. BullMQ delayed jobs are the scheduler.
