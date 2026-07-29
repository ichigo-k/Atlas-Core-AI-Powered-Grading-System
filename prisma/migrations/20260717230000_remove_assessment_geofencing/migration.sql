ALTER TABLE "assessments"
DROP COLUMN IF EXISTS "latitude",
DROP COLUMN IF EXISTS "longitude",
DROP COLUMN IF EXISTS "geofenceRadiusM",
DROP COLUMN IF EXISTS "awsGeofenceId";

UPDATE "assessments"
SET "isLocationBound" = false,
    "location" = NULL
WHERE "isLocationBound" = true OR "location" IS NOT NULL;
