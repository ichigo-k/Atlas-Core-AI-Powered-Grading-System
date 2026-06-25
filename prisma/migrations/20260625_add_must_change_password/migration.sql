-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Set existing users to false (they've already been using the system)
UPDATE "users" SET "must_change_password" = false;
