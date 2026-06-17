import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { ActiveAttempt, AssessmentDetail } from "@/lib/student-queries";
import {
  getActiveAttempt,
  getAssessmentWithQuestions,
} from "@/lib/student-queries";
import AttemptShell from "./AttemptShell";

export type ProctorSession = {
  sessionId: string;
} | null;

// ─── Serialisation helpers ────────────────────────────────────────────────────

export type SerializedActiveAttempt = {
  id: number;
  assessmentId: number;
  studentId: number;
  attemptNumber: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  questionOrder: unknown;
  tabSwitchLog: unknown;
  answers: {
    id: number;
    questionId: number;
    answerText: string | null;
    selectedOption: number | null;
    fileUrl: string | null;
  }[];
};

export type SerializedAssessmentDetail = Omit<
  AssessmentDetail,
  "startsAt" | "endsAt"
> & {
  startsAt: string;
  endsAt: string;
};

function serializeAttempt(attempt: ActiveAttempt): SerializedActiveAttempt {
  return {
    ...attempt,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
  };
}

function serializeAssessment(
  assessment: AssessmentDetail,
): SerializedAssessmentDetail {
  return {
    ...assessment,
    startsAt: assessment.startsAt.toISOString(),
    endsAt: assessment.endsAt.toISOString(),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { id } = await params;
  const { attemptId: attemptIdStr } = await searchParams;

  const assessmentId = Number(id);
  const attemptId = Number(attemptIdStr);

  if (Number.isNaN(assessmentId)) {
    redirect("/student/assessments");
  }

  const session = await getSession();
  const email = session?.user?.email;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;
  const studentId = user?.id ?? null;

  if (!studentId || !attemptId || Number.isNaN(attemptId)) {
    redirect(`/student/assessments/${assessmentId}`);
  }

  const attempt = await getActiveAttempt(attemptId, studentId);
  if (!attempt) {
    redirect(`/student/assessments/${assessmentId}`);
  }

  if (attempt.status === "SUBMITTED" || attempt.status === "TIMED_OUT") {
    redirect(`/student/assessments/${assessmentId}`);
  }

  const assessment = await getAssessmentWithQuestions(assessmentId, studentId);
  if (!assessment) {
    redirect(`/student/assessments/${assessmentId}`);
  }

  // Use proctorRecord included in getActiveAttempt so the client can initialise WebRTC.
  // Returns null when no proctoring session exists (non-proctored exam).
  const proctorSession: ProctorSession = attempt.proctorRecord
    ? { sessionId: attempt.proctorRecord.sessionId }
    : null;

  return (
    <AttemptShell
      attempt={serializeAttempt(attempt)}
      assessment={serializeAssessment(assessment)}
      assessmentId={assessmentId}
      proctorSession={proctorSession}
    />
  );
}
