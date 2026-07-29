import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { ActiveAttempt, AssessmentDetail } from "@/lib/student-queries";
import {
  getActiveAttempt,
  getAssessmentWithQuestions,
} from "@/lib/student-queries";
import { submitAttemptInternal } from "@/lib/assessment-actions";
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
  /** When the exam clock started (first view of the questions). */
  timerStartedAt: string | null;
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

function serializeAttempt(
  attempt: ActiveAttempt,
  timerStartedAt: Date,
): SerializedActiveAttempt {
  return {
    ...attempt,
    startedAt: attempt.startedAt.toISOString(),
    timerStartedAt: timerStartedAt.toISOString(),
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

  // ── Start the exam clock ────────────────────────────────────────────────────
  // This page is the first moment the student can actually see questions, so
  // this is where the duration starts counting. The attempt row itself was
  // created back in onboarding (rules → password → mic/camera checks), and that
  // time must not be charged against them. The write is guarded on
  // `timerStartedAt: null` so a reload, a second tab, or a resume later in the
  // exam can never restart or extend the clock.
  const now = new Date();
  let timerStartedAt = attempt.timerStartedAt;
  if (!timerStartedAt) {
    const claimed = await prisma.assessmentAttempt.updateMany({
      where: { id: attempt.id, timerStartedAt: null },
      data: { timerStartedAt: now },
    });
    if (claimed.count > 0) {
      timerStartedAt = now;
    } else {
      // Another request stamped it first — use the value it wrote.
      const fresh = await prisma.assessmentAttempt.findUnique({
        where: { id: attempt.id },
        select: { timerStartedAt: true },
      });
      timerStartedAt = fresh?.timerStartedAt ?? now;
    }
  }

  // Check attempt expiration
  let expired = false;
  if (assessment.durationMinutes) {
    const expiryTime = new Date(timerStartedAt.getTime() + assessment.durationMinutes * 60 * 1000);
    if (now > expiryTime) {
      expired = true;
    }
  }
  if (now > assessment.endsAt || assessment.status === "CLOSED") {
    expired = true;
  }

  if (expired) {
    await submitAttemptInternal(attempt.id, assessmentId, "TIMED_OUT");
    redirect(`/student/assessments/${assessmentId}`);
  }

  // Use proctorRecord included in getActiveAttempt so the client can initialise WebRTC.
  // Returns null when no proctoring session exists (non-proctored exam).
  const proctorSession: ProctorSession = attempt.proctorRecord
    ? { sessionId: attempt.proctorRecord.sessionId }
    : null;

  return (
    <AttemptShell
      attempt={serializeAttempt(attempt, timerStartedAt)}
      assessment={serializeAssessment(assessment)}
      assessmentId={assessmentId}
      proctorSession={proctorSession}
    />
  );
}
