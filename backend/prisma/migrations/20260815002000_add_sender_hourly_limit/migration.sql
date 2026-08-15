-- One sender-wide policy is authoritative for all current and future batches.
ALTER TABLE "senders" ADD COLUMN "hourly_limit" INTEGER NOT NULL DEFAULT 50;
