-- Persist a user's email wishlist/favorite state across refreshes and restarts.
ALTER TABLE "emails" ADD COLUMN "is_starred" BOOLEAN NOT NULL DEFAULT false;
