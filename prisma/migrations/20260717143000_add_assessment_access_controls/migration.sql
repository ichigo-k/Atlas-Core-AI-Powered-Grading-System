CREATE TABLE "trusted_networks" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cidrs" TEXT[] NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trusted_networks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "assessments"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geofenceRadiusM" INTEGER,
ADD COLUMN "awsGeofenceId" TEXT,
ADD COLUMN "requireTrustedNetwork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trustedNetworkId" INTEGER;

ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_trustedNetworkId_fkey"
FOREIGN KEY ("trustedNetworkId") REFERENCES "trusted_networks"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
