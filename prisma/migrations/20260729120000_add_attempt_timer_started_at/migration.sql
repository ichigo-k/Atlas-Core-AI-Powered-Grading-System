-- The exam clock now starts when the student first opens the attempt page and
-- sees questions, not when the attempt row is created during onboarding.
ALTER TABLE "assessment_attempts"
ADD COLUMN IF NOT EXISTS "timerStartedAt" TIMESTAMP(3);

-- Attempts that already exist (created under the old behaviour, and any that
-- are mid-exam right now) keep counting from startedAt, so nobody in a live
-- exam suddenly gets their clock reset.
UPDATE "assessment_attempts"
SET "timerStartedAt" = "startedAt"
WHERE "timerStartedAt" IS NULL;
