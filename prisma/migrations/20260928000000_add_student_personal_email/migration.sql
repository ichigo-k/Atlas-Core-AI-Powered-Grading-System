ALTER TABLE "student_profiles" ADD COLUMN "personal_email" TEXT;
CREATE UNIQUE INDEX "student_profiles_personal_email_key" ON "student_profiles"("personal_email");
