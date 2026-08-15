import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { DelayedError, Queue, Worker, type Job } from 'bullmq';
import { EmailStatus, type Sender, type User } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma.js';
import { createRedisConnection, redis } from '../config/redis.js';
import { config } from '../config/index.js';
import { emailRouter } from '../routes/email.routes.js';
import { emailQueue, EMAIL_QUEUE_NAME, queueConnection } from '../services/emailQueue.js';
import { sendEmailViaSender } from '../services/emailSender.js';
import { processEmailJob } from '../services/emailWorker.js';
import { acquireSenderSendSlot, senderRateLimitKey, senderSendGateKey } from '../services/rateLimiter.js';

vi.mock('../services/emailSender.js', () => ({
  sendEmailViaSender: vi.fn(),
}));

const runIntegration = process.env.RUN_INTEGRATION === '1';
const describeIntegration = runIntegration ? describe : describe.skip;
const createdUsers: string[] = [];
const createdSenders: string[] = [];
let originalMinDelayMs = config.minDelayMs;
let originalRedisUnavailableRetryMs = config.redisUnavailableRetryMs;

async function createFixture(hourlyLimit = 10): Promise<{ user: User; sender: Sender }> {
  const token = randomUUID();
  const user = await prisma.user.create({
    data: {
      googleId: `integration-${token}`,
      email: `integration-${token}@example.test`,
      name: 'Integration Tester',
    },
  });
  createdUsers.push(user.id);
  const sender = await prisma.sender.create({
    data: {
      userId: user.id,
      name: 'Integration Tester',
      email: `sender-${token}@ethereal.test`,
      smtpHost: 'smtp.example.test',
      smtpPort: 587,
      smtpUser: `smtp-${token}`,
      smtpPass: 'not-used-by-mocked-transport',
      hourlyLimit,
    },
  });
  createdSenders.push(sender.id);
  return { user, sender };
}

async function createEmail(sender: Sender, user: User, recipientEmail = `recipient-${randomUUID()}@example.test`) {
  return prisma.email.create({
    data: {
      userId: user.id,
      senderId: sender.id,
      batchId: randomUUID(),
      recipientEmail,
      subject: 'Integration delivery',
      bodyHtml: '<p>Integration delivery</p>',
      scheduledAt: new Date(),
      delayBetweenMs: 0,
      hourlyLimit: sender.hourlyLimit,
      idempotencyKey: `email-${randomUUID()}`,
      status: EmailStatus.queued,
    },
  });
}

function testJob(emailId: string): Job {
  return {
    data: { emailId, senderId: 'unused-in-processor' },
    opts: { attempts: 3 },
    attemptsMade: 0,
    token: 'integration-token',
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job;
}

async function waitForGate(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 8));
}

describeIntegration('scheduler integration (PostgreSQL + Redis + BullMQ)', () => {
  beforeEach(() => {
    vi.mocked(sendEmailViaSender).mockReset();
    vi.mocked(sendEmailViaSender).mockResolvedValue({ previewUrl: 'https://ethereal.test/preview' });
    originalMinDelayMs = config.minDelayMs;
    originalRedisUnavailableRetryMs = config.redisUnavailableRetryMs;
    config.minDelayMs = 1;
  });

  afterEach(async () => {
    config.minDelayMs = originalMinDelayMs;
    config.redisUnavailableRetryMs = originalRedisUnavailableRetryMs;
    vi.restoreAllMocks();
    const users = createdUsers.splice(0);
    const senders = createdSenders.splice(0);
    for (const senderId of senders) {
      await Promise.all([
        redis.del(senderRateLimitKey(senderId)),
        redis.del(senderSendGateKey(senderId)),
      ]);
    }
    for (const userId of users) {
      const emails = await prisma.email.findMany({ where: { userId }, select: { id: true, senderId: true } });
      await Promise.all(emails.map((email) => emailQueue.remove(`email-${email.id}`).catch(() => undefined)));
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  afterAll(async () => {
    await Promise.all([emailQueue.close(), queueConnection.quit(), redis.quit(), prisma.$disconnect()]);
  });

  it('schedules authenticated records with sender policy snapshots and unique BullMQ jobs', async () => {
    const { user, sender } = await createFixture(2);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = user;
      req.isAuthenticated = () => true;
      next();
    });
    app.use('/api/emails', emailRouter);

    const start = new Date(Date.now() + 5 * 60_000).toISOString();
    const response = await request(app).post('/api/emails/schedule').send({
      senderId: sender.id,
      recipients: ['one@example.test', 'two@example.test', 'three@example.test'],
      subject: 'Batch',
      bodyHtml: '<p>Body</p>',
      scheduledAt: start,
      delayBetweenMs: 100,
    });

    expect(response.status).toBe(201);
    const emails = await prisma.email.findMany({ where: { batchId: response.body.batchId }, orderBy: { scheduledAt: 'asc' } });
    expect(emails).toHaveLength(3);
    expect(emails.map((email) => email.status)).toEqual([EmailStatus.queued, EmailStatus.queued, EmailStatus.queued]);
    expect(emails.map((email) => email.hourlyLimit)).toEqual([2, 2, 2]);
    expect(emails[1].scheduledAt.getTime() - emails[0].scheduledAt.getTime()).toBe(100);
    expect(emails[2].scheduledAt.getTime()).toBeGreaterThan(emails[1].scheduledAt.getTime() + 1_000_000);
    await Promise.all(emails.map(async (email) => expect((await emailQueue.getJob(`email-${email.id}`))?.id).toBe(`email-${email.id}`)));

    const batchResponse = await request(app).get('/api/emails/batches').query({ status: 'queued,pending,sending,rate_limited' });
    expect(batchResponse.status).toBe(200);
    expect(batchResponse.body.batches).toHaveLength(1);
    expect(batchResponse.body.batches[0]).toMatchObject({
      batchId: response.body.batchId,
      emailCount: 3,
      statusCounts: { queued: 3 },
      effectiveDelayBetweenMs: 100,
      hourlyLimit: 2,
      sender: { id: sender.id, email: sender.email },
    });

    const batchEmailsResponse = await request(app).get('/api/emails').query({ batchId: response.body.batchId, limit: 100 });
    expect(batchEmailsResponse.status).toBe(200);
    expect(batchEmailsResponse.body.total).toBe(3);

    const starredResponse = await request(app).patch(`/api/emails/${emails[0].id}/star`).send({ isStarred: true });
    expect(starredResponse.status).toBe(200);
    expect(starredResponse.body.isStarred).toBe(true);
    expect((await prisma.email.findUniqueOrThrow({ where: { id: emails[0].id } })).isStarred).toBe(true);

    const conflictingRequest = await request(app).post('/api/emails/schedule').send({
      senderId: sender.id,
      recipients: ['conflict@example.test'],
      subject: 'Conflicting limit',
      bodyHtml: '<p>Body</p>',
      scheduledAt: start,
      delayBetweenMs: 100,
      hourlyLimit: 20,
    });
    expect(conflictingRequest.status).toBe(409);
  });

  it('delivers a real BullMQ worker job, stores sent state, and skips duplicate handling', async () => {
    const { user, sender } = await createFixture();
    const email = await createEmail(sender, user);
    const queueName = `integration-email-queue-${randomUUID()}`;
    const queue = new Queue(queueName, { connection: createRedisConnection() });
    const worker = new Worker(queueName, processEmailJob, { connection: createRedisConnection(), concurrency: 1 });
    const completed = new Promise<void>((resolve, reject) => {
      worker.once('completed', () => resolve());
      worker.once('failed', (_job, error) => reject(error));
    });

    try {
      await queue.add('send-email', { emailId: email.id, senderId: sender.id }, { jobId: `email-${email.id}` });
      await completed;
      await processEmailJob(testJob(email.id));
    } finally {
      await Promise.all([worker.close(), queue.close()]);
    }

    const delivered = await prisma.email.findUniqueOrThrow({ where: { id: email.id } });
    expect(delivered.status).toBe(EmailStatus.sent);
    expect(delivered.sentAt).toBeInstanceOf(Date);
    expect(sendEmailViaSender).toHaveBeenCalledTimes(1);
  });

  it('keeps concurrent worker handlers for one sender inside the shared minimum-delay gate', async () => {
    const { user, sender } = await createFixture(10);
    const first = await createEmail(sender, user);
    const second = await createEmail(sender, user);
    config.minDelayMs = 100;

    const results = await Promise.allSettled([
      processEmailJob(testJob(first.id)),
      processEmailJob(testJob(second.id)),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const statuses = await Promise.all([first.id, second.id].map(async (id) => (await prisma.email.findUniqueOrThrow({ where: { id } })).status));
    expect(statuses.sort()).toEqual([EmailStatus.queued, EmailStatus.sent]);
    expect(sendEmailViaSender).toHaveBeenCalledTimes(1);
  });

  it('defers the third job at the sender-level hourly limit without an SMTP failure', async () => {
    const { user, sender } = await createFixture(2);
    const first = await createEmail(sender, user);
    const second = await createEmail(sender, user);
    const third = await createEmail(sender, user);
    await prisma.email.update({ where: { id: third.id }, data: { hourlyLimit: 100 } });

    await processEmailJob(testJob(first.id));
    await waitForGate();
    await processEmailJob(testJob(second.id));
    await waitForGate();
    const deferredJob = testJob(third.id);
    await expect(processEmailJob(deferredJob)).rejects.toBeInstanceOf(DelayedError);

    expect((await prisma.email.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(EmailStatus.sent);
    expect((await prisma.email.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(EmailStatus.sent);
    const deferred = await prisma.email.findUniqueOrThrow({ where: { id: third.id } });
    expect(deferred.status).toBe(EmailStatus.rate_limited);
    expect(deferred.sentAt).toBeNull();
    expect(deferredJob.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(sendEmailViaSender).toHaveBeenCalledTimes(2);
  });

  it('allows only one concurrent worker to reserve a sender gate interval', async () => {
    const { sender } = await createFixture(10);
    const now = Date.now();
    const slots = await Promise.all([
      acquireSenderSendSlot(redis, sender.id, sender.hourlyLimit, 100, now),
      acquireSenderSendSlot(redis, sender.id, sender.hourlyLimit, 100, now),
    ]);
    expect(slots.filter((slot) => slot.allowed)).toHaveLength(1);
    expect(slots.find((slot) => !slot.allowed)).toMatchObject({ reason: 'minimum_delay' });
  });

  it('defers without SMTP delivery when Redis throttle enforcement is unavailable', async () => {
    const { user, sender } = await createFixture();
    const email = await createEmail(sender, user);
    const job = testJob(email.id);
    config.redisUnavailableRetryMs = 100;
    vi.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('Redis unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(processEmailJob(job)).rejects.toBeInstanceOf(DelayedError);

    const deferred = await prisma.email.findUniqueOrThrow({ where: { id: email.id } });
    expect(deferred.status).toBe(EmailStatus.queued);
    expect(deferred.errorMessage).toContain('Redis throttle unavailable');
    expect(deferred.sentAt).toBeNull();
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(sendEmailViaSender).not.toHaveBeenCalled();
  });

  it('keeps a future delayed job after a fresh Queue client reconnects', async () => {
    const queue = new Queue(EMAIL_QUEUE_NAME, { connection: createRedisConnection() });
    const jobId = `restart-${randomUUID()}`;
    try {
      await queue.add('send-email', { emailId: randomUUID(), senderId: randomUUID() }, { jobId, delay: 60_000 });
      await queue.close();
      const restartedQueue = new Queue(EMAIL_QUEUE_NAME, { connection: createRedisConnection() });
      try {
        expect(await restartedQueue.getJob(jobId)).toBeTruthy();
        await restartedQueue.remove(jobId);
      } finally {
        await restartedQueue.close();
      }
    } finally {
      await queue.close().catch(() => undefined);
    }
  });
});
