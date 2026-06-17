-- Drop NOT NULL constraint from signalingToken — column was used for LiveKit tokens
-- which no longer exist now that proctoring is client-side ML (no Oracle/LiveKit).
ALTER TABLE "proctor_records" ALTER COLUMN "signalingToken" DROP NOT NULL;
