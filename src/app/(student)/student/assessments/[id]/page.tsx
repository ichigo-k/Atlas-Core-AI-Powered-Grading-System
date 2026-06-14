import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Layers,
  Lock,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { computeGrade, parseGradingScale } from "@/lib/grading-scale";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  getAssessmentWithQuestions,
  getStudentAttempts,
} from "@/lib/student-queries";
import AssessmentEntryClient from "./AssessmentEntryClient";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const typeBadgeStyles: Record<string, { bg: string; text: string }> = {
  EXAM: { bg: "#FEE2E2", text: "#991B1B" },
  QUIZ: { bg: "#FEF3C7", text: "#92400E" },
  ASSIGNMENT: { bg: "#DBEAFE", text: "#1E40AF" },
};

const sectionTypeBadge: Record<string, { bg: string; text: string }> = {
  OBJECTIVE: { bg: "#F0FDF4", text: "#166534" },
  SUBJECTIVE: { bg: "#F5F3FF", text: "#5B21B6" },
};

// GCTU primary color and Oracle integration flag
const primaryColor = "#002388";
const oracleConfigured = !!(
  process.env.ORACLE_BASE_URL || process.env.NEXT_PUBLIC_ORACLE_BASE_URL
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ startStatus?: string }>;
}) {
  const { id } = await params;
  const { startStatus } = searchParams
    ? await searchParams
    : { startStatus: undefined };
  const assessmentId = Number(id);
  if (Number.isNaN(assessmentId)) notFound();

  // Resolve student identity
  const session = await getSession();
  const email = session?.user?.email;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;
  const studentId = user?.id ?? null;

  // Fetch data
  const assessment = await getAssessmentWithQuestions(
    assessmentId,
    studentId ?? undefined,
  );
  if (!assessment) notFound();

  const attempts = studentId
    ? await getStudentAttempts(studentId, assessmentId)
    : [];

  // Fetch resultsReleased and gradingStatus separately (not included in getAssessmentWithQuestions)
  const assessmentMeta = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { resultsReleased: true, gradingStatus: true },
  });
  const resultsReleased = assessmentMeta?.resultsReleased ?? false;

  // If there's an active IN_PROGRESS attempt, redirect to the shared onboarding flow.
  // The shared onboarding includes the camera check when proctoring is enabled.
  const activeAttempt =
    attempts.find((a) => a.status === "IN_PROGRESS") ?? null;
  if (activeAttempt) {
    redirect(
      `/student/assessments/${assessmentId}/assessment-onboarding?attemptId=${activeAttempt.id}`,
    );
  }

  const now = new Date();
  const isUpcoming = now < assessment.startsAt;
  const isEnded = now > assessment.endsAt;
  const isLocked = attempts.length >= assessment.maxAttempts;
  const hasSubmitted = attempts.some(
    (a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT",
  );
  const latestSubmitted =
    attempts
      .filter((a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT")
      .sort(
        (a, b) =>
          (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
      )[0] ?? null;

  // Compute grade letter — only when results are released and a score exists
  let grade: string | null = null;
  if (resultsReleased && latestSubmitted?.score != null) {
    const settingsRow = await prisma.systemSettings.findFirst({
      select: { gradingScale: true },
    });
    const scale = parseGradingScale(settingsRow?.gradingScale);
    grade = computeGrade(latestSubmitted.score, assessment.totalMarks, scale);
  }

  // Determine the forced-submit reason from the tab switch log
  type LogEntry = { event?: string; timestamp?: string };
  const submissionReason = (() => {
    if (!latestSubmitted) return null;
    const log = Array.isArray(latestSubmitted.tabSwitchLog)
      ? (latestSubmitted.tabSwitchLog as LogEntry[])
      : [];
    if (log.some((e) => e.event === "FULLSCREEN_VIOLATION"))
      return "FULLSCREEN_VIOLATION";
    if (latestSubmitted.status === "TIMED_OUT") return "TIMED_OUT";
    return null;
  })();

  const typeStyle = typeBadgeStyles[assessment.type] ?? {
    bg: "#F1F5F9",
    text: "#475569",
  };

  const totalQuestions = assessment.sections.reduce(
    (sum, s) => sum + s.questions.length,
    0,
  );

  // Determine what to show in the entry area
  const startExpiredMessage = startStatus === "ended";

  const startStatusBanner = startExpiredMessage ? (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <AlertCircle size={18} className="shrink-0 text-red-500" />
      <div>
        <p className="font-medium text-red-800">Assessment time has expired</p>
        <p className="text-sm text-red-600">
          This assessment window has closed. Any unfinished attempt has been
          marked as timed out.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Back nav */}
      <Link
        href="/student/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-[#002388] hover:text-[#001f6a] transition-colors"
      >
        <ChevronLeft size={16} />
        All Assessments
      </Link>

      {/* Hero card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: typeStyle.bg, color: typeStyle.text }}
          >
            {assessment.type}
          </span>
          {assessment.passwordProtected && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Password Protected
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Not Yet Open
            </span>
          )}
          {isEnded && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 uppercase tracking-wider">
              Closed
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-[#002388]">
            {assessment.title}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <BookOpen size={14} />
            {assessment.courseTitle}
            <span className="text-slate-300">·</span>
            <span className="font-mono text-xs text-slate-400">
              {assessment.courseCode}
            </span>
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Total Marks</span>
            <span className="text-lg font-semibold text-slate-800 flex items-center gap-1">
              <Award size={14} className="text-[#002388]" />
              {assessment.totalMarks}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Duration</span>
            <span className="text-lg font-semibold text-slate-800 flex items-center gap-1">
              <Clock size={14} className="text-[#002388]" />
              {assessment.durationMinutes
                ? `${assessment.durationMinutes} min`
                : "Untimed"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Attempts</span>
            <span className="text-lg font-semibold text-slate-800">
              {attempts.length} / {assessment.maxAttempts}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Questions</span>
            <span className="text-lg font-semibold text-slate-800">
              {totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* Dates & location */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Schedule
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <Calendar size={15} className="mt-0.5 shrink-0 text-[#002388]" />
            <div>
              <p className="text-xs text-slate-400">Opens</p>
              <p className="text-sm font-medium text-slate-700">
                {formatDate(assessment.startsAt)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Calendar size={15} className="mt-0.5 shrink-0 text-[#002388]" />
            <div>
              <p className="text-xs text-slate-400">Closes</p>
              <p className="text-sm font-medium text-slate-700">
                {formatDate(assessment.endsAt)}
              </p>
            </div>
          </div>
          {assessment.isLocationBound && assessment.location && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Location</p>
                <p className="text-sm font-medium text-slate-700">
                  {assessment.location}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      {assessment.sections.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Layers size={14} className="text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sections
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {assessment.sections.map((section) => {
              const badge = sectionTypeBadge[section.type] ?? {
                bg: "#F1F5F9",
                text: "#475569",
              };
              return (
                <li
                  key={section.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {section.type}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-700">
                      {section.name}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {section.questions.length} question
                    {section.questions.length !== 1 ? "s" : ""}
                    {section.requiredQuestionsCount != null &&
                      section.requiredQuestionsCount < section.questions.length
                      ? ` (answer ${section.requiredQuestionsCount})`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Entry / status area */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        {startStatusBanner}
        {!studentId ? (
          <p className="text-sm text-slate-500">
            Please sign in to start this assessment.
          </p>
        ) : hasSubmitted && isLocked ? (
          /* All attempts used — show submitted/locked state */
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">
                Assessment Submitted
              </p>
              <p className="mt-1 text-sm text-slate-500">
                You submitted this assessment on{" "}
                {latestSubmitted?.submittedAt
                  ? formatDate(latestSubmitted.submittedAt)
                  : "—"}
                .
              </p>
              {latestSubmitted?.status === "TIMED_OUT" && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  {submissionReason === "FULLSCREEN_VIOLATION"
                    ? "Auto-submitted: fullscreen exited too many times."
                    : "Auto-submitted due to time expiry."}
                </p>
              )}
            </div>
            {/* Results section — only shown when results are released */}
            {resultsReleased && latestSubmitted?.score != null ? (
              <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-center">
                <p className="text-xs text-green-600 font-medium">Your Score</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {latestSubmitted.score}{" "}
                  <span className="text-sm font-normal text-green-600">
                    / {assessment.totalMarks}
                  </span>
                </p>
                {grade && (
                  <p className="text-sm font-semibold text-green-700 mt-1">
                    Grade: {grade}
                  </p>
                )}
              </div>
            ) : !resultsReleased && hasSubmitted ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs text-slate-500">
                  Results have not been released yet
                </p>
              </div>
            ) : null}
            <Link
              href="/student/assessments"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#E6F0FF] px-4 py-2 text-sm font-medium text-[#002388] hover:bg-[#cfe0ff] transition-colors"
            >
              <ChevronLeft size={14} />
              Back to Assessments
            </Link>
          </div>
        ) : isUpcoming ? (
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
            <AlertCircle size={18} className="shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-blue-800">
                Assessment not yet open
              </p>
              <p className="text-sm text-blue-600">
                This assessment opens on {formatDate(assessment.startsAt)}.
              </p>
            </div>
          </div>
        ) : isEnded ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <Lock size={18} className="shrink-0 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">Assessment closed</p>
              <p className="text-sm text-slate-500">
                This assessment closed on {formatDate(assessment.endsAt)}.
              </p>
            </div>
          </div>
        ) : isLocked ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <Lock size={18} className="shrink-0 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">
                Maximum attempts reached
              </p>
              <p className="text-sm text-slate-500">
                You have used all available attempts for this assessment.
              </p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Start
            </h2>
            {hasSubmitted && latestSubmitted && (
              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-green-500"
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    Attempt {latestSubmitted.attemptNumber} submitted
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submitted on{" "}
                    {latestSubmitted.submittedAt
                      ? formatDate(latestSubmitted.submittedAt)
                      : "—"}
                    . You have {assessment.maxAttempts - attempts.length}{" "}
                    attempt
                    {assessment.maxAttempts - attempts.length !== 1 ? "s" : ""}{" "}
                    remaining.
                  </p>
                </div>
              </div>
            )}
            {
              // Defensive rendering: wrap client component creation so any
              // server-side rendering errors are caught and displayed with
              // helpful debug info instead of producing an opaque RSC failure.
              (() => {
                try {
                  return (
                    <AssessmentEntryClient
                      assessmentId={assessmentId}
                      passwordProtected={assessment.passwordProtected}
                      proctoringEnabled={
                        assessment.proctoringEnabled && oracleConfigured
                      }
                      isLocked={isLocked}
                      activeAttemptId={null}
                      assessmentType={assessment.type}
                      durationMinutes={assessment.durationMinutes ?? null}
                      startsAt={assessment.startsAt.toISOString()}
                      endsAt={assessment.endsAt.toISOString()}
                    />
                  );
                } catch (err) {
                  // Render debug info to help trace serialization/render issues
                  return (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <strong>Server render error:</strong>
                      <div>{String(err)}</div>
                      <div className="mt-2 text-xs text-red-600">
                        Props:{" "}
                        {JSON.stringify({
                          assessmentId,
                          passwordProtected: assessment.passwordProtected,
                          proctoringEnabled:
                            assessment.proctoringEnabled && oracleConfigured,
                          isLocked,
                          assessmentType: assessment.type,
                        })}
                      </div>
                    </div>
                  );
                }
              })()
            }
          </>
        )}
      </div>
    </div>
  );
}
