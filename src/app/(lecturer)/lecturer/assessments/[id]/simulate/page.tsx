import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAssessmentWithQuestions } from "@/lib/student-queries";
import AttemptShell from "@/app/(exam)/student/assessments/[id]/attempt/AttemptShell";
import type {
  SerializedActiveAttempt,
  SerializedAssessmentDetail,
} from "@/app/(exam)/student/assessments/[id]/attempt/page";

export default async function SimulatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assessmentId = Number(id);

  if (Number.isNaN(assessmentId)) {
    redirect("/lecturer/assessments");
  }

  const session = await getSession();
  if (!session || session.user.role !== "LECTURER") {
    redirect("/lecturer/assessments");
  }

  const assessmentRaw = await getAssessmentWithQuestions(assessmentId);
  if (!assessmentRaw) {
    redirect("/lecturer/assessments");
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const assessment = assessmentRaw!;

  // Build a mock attempt — no DB record created, no data will be saved.
  const mockAttempt: SerializedActiveAttempt = {
    id: 0,
    assessmentId,
    studentId: 0,
    attemptNumber: 1,
    status: "IN_PROGRESS",
    startedAt: new Date().toISOString(),
    submittedAt: null,
    questionOrder: [],
    tabSwitchLog: [],
    answers: [],
  };

  const serializedAssessment: SerializedAssessmentDetail = {
    id: assessment.id,
    title: assessment.title,
    type: assessment.type,
    status: assessment.status,
    courseId: assessment.courseId,
    courseTitle: assessment.courseTitle,
    courseCode: assessment.courseCode,
    startsAt: assessment.startsAt.toISOString(),
    endsAt: assessment.endsAt.toISOString(),
    durationMinutes: assessment.durationMinutes,
    totalMarks: assessment.totalMarks,
    maxAttempts: assessment.maxAttempts,
    passwordProtected: assessment.passwordProtected,
    shuffleQuestions: assessment.shuffleQuestions,
    shuffleOptions: assessment.shuffleOptions,
    isLocationBound: assessment.isLocationBound,
    location: assessment.location,
    proctoringEnabled: assessment.proctoringEnabled,
    sections: assessment.sections,
  };

  return (
    <AttemptShell
      attempt={mockAttempt}
      assessment={serializedAssessment}
      assessmentId={assessmentId}
      proctorSession={null}
      simulation={true}
      simulationReturnUrl={`/lecturer/assessments/${assessmentId}`}
    />
  );
}
