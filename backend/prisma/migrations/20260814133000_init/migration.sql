-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'queued', 'sending', 'sent', 'failed', 'rate_limited');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "senders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emails" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" VARCHAR(1000) NOT NULL,
    "body_html" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "ethereal_url" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "delay_between_ms" INTEGER NOT NULL,
    "hourly_limit" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "senders_user_id_idx" ON "senders"("user_id");
CREATE UNIQUE INDEX "senders_user_id_email_key" ON "senders"("user_id", "email");
CREATE UNIQUE INDEX "emails_idempotency_key_key" ON "emails"("idempotency_key");
CREATE INDEX "emails_user_id_status_idx" ON "emails"("user_id", "status");
CREATE INDEX "emails_batch_id_idx" ON "emails"("batch_id");
CREATE INDEX "emails_sender_id_idx" ON "emails"("sender_id");
CREATE INDEX "emails_scheduled_at_idx" ON "emails"("scheduled_at");

ALTER TABLE "senders" ADD CONSTRAINT "senders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emails" ADD CONSTRAINT "emails_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
