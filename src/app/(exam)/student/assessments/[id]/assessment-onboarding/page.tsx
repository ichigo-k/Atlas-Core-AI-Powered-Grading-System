import { redirect } from "next/navigation";
import { expireAbandonedAttempts } from "@/lib/assessment-actions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import AssessmentOnboardingClient from "./AssessmentOnboardingClient";

export default async function AssessmentOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { id } = await params;
  const { attemptId: attemptIdStr } = await searchParams;
  const assessmentId = Number(id);
  const attemptId = attemptIdStr ? Number(attemptIdStr) : null;

  if (Number.isNaN(assessmentId)) {
    redirect("/student/assessments");
  }

  const session = await getSession();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      type: true,
      durationMinutes: true,
      passwordProtected: true,
      proctoringEnabled: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!assessment) redirect(`/student/assessments/${assessmentId}`);

  const now = new Date();
  if (assessment.status !== "PUBLISHED" || now < assessment.startsAt) {
    redirect(`/student/assessments/${assessmentId}`);
  }

  if (now > assessment.endsAt) {
    await expireAbandonedAttempts(assessmentId, user.id);
    redirect(`/student/assessments/${assessmentId}?startStatus=ended`);
  }

  let validatedAttemptId: number | null = null;
  if (attemptId != null && !Number.isNaN(attemptId)) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        status: true,
        assessmentId: true,
      },
    });

    if (
      !attempt ||
      attempt.studentId !== user.id ||
      attempt.status !== "IN_PROGRESS" ||
      attempt.assessmentId !== assessmentId
    ) {
      redirect(`/student/assessments/${assessmentId}`);
    }

    validatedAttemptId = attempt.id;
  }

  return (
    <AssessmentOnboardingClient
      assessmentId={assessmentId}
      attemptId={validatedAttemptId}
      assessmentType={assessment.type}
      durationMinutes={assessment.durationMinutes}
      passwordProtected={assessment.passwordProtected}
      proctoringEnabled={assessment.proctoringEnabled}
    />
  );
}
