-- A dashboard alias maps to an independently provisioned Ethereal mailbox.
-- It is intentionally not unique: every creation receives a fresh mailbox.
ALTER TABLE "senders" ADD COLUMN "alias_email" TEXT;
