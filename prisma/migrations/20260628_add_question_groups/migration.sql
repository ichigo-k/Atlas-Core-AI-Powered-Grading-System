-- CreateTable
CREATE TABLE "question_groups" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "context" TEXT,
    "totalMarks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "groupId" INTEGER;
ALTER TABLE "questions" ADD COLUMN "groupOrder" INTEGER;

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "assessment_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "question_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
