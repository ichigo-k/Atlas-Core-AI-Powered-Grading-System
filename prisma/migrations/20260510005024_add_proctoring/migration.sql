-- CreateEnum
CREATE TYPE "ProctorStatus" AS ENUM ('ACTIVE', 'ENDED', 'TIMED_OUT');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "proctoringEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "proctor_records" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "signalingToken" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "flagThreshold" INTEGER NOT NULL DEFAULT 5,
    "proctoringLog" JSONB NOT NULL DEFAULT '[]',
    "status" "ProctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proctor_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proctor_records_attemptId_key" ON "proctor_records"("attemptId");

-- AddForeignKey
ALTER TABLE "proctor_records" ADD CONSTRAINT "proctor_records_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
