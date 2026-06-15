/*
  Warnings:

  - You are about to drop the column `adjusted_score` on the `assessment_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `adjustment_reason` on the `assessment_attempts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assessment_attempts" DROP COLUMN "adjusted_score",
DROP COLUMN "adjustment_reason";

-- AlterTable
ALTER TABLE "student_answers" ADD COLUMN     "lecturer_adjust_reason" TEXT,
ADD COLUMN     "lecturer_adjusted_score" DOUBLE PRECISION;
