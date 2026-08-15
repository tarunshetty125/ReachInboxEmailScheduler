-- Persist each uploaded file once, then link it to every email that uses it.
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_attachments" (
    "email_id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("email_id", "attachment_id")
);

CREATE INDEX "attachments_user_id_idx" ON "attachments"("user_id");
CREATE INDEX "email_attachments_attachment_id_idx" ON "email_attachments"("attachment_id");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_email_id_fkey"
  FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
