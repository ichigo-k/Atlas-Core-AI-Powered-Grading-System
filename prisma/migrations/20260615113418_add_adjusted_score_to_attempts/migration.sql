-- AlterTable
ALTER TABLE "assessment_attempts" ADD COLUMN     "adjusted_score" DOUBLE PRECISION,
ADD COLUMN     "adjustment_reason" TEXT;
