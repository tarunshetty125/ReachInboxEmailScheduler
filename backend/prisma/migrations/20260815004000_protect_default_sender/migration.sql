-- Each user can have at most one protected default Ethereal sender.
CREATE UNIQUE INDEX "senders_one_default_per_user_key"
  ON "senders"("user_id")
  WHERE "is_default" = true;

-- This is deliberately enforced in PostgreSQL, not only in Express, so a
-- direct Prisma Studio delete cannot remove the account's required sender.
CREATE OR REPLACE FUNCTION "prevent_default_sender_deletion"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."is_default" THEN
    RAISE EXCEPTION 'The default sender cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "senders_prevent_default_delete"
  BEFORE DELETE ON "senders"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_default_sender_deletion"();
