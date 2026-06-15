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
  ClipboardList,
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
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const typeBadgeStyles: Record<string, { bg: string; text: string }> = {
  EXAM:       { bg: "#fee2e2", text: "#991b1b" },
  QUIZ:       { bg: "#fef9c3", text: "#854d0e" },
  ASSIGNMENT: { bg: "#dcfce7", text: "#166534" },
};

const sectionTypeBadge: Record<string, { bg: string; text: string }> = {
  OBJECTIVE:  { bg: "#dcfce7", text: "#166534" },
  SUBJECTIVE: { bg: "#f1f5f9", text: "#475569" },
};

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

  const assessmentMeta = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { resultsReleased: true, gradingStatus: true },
  });
  const resultsReleased = assessmentMeta?.resultsReleased ?? false;

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

  let grade: string | null = null;
  if (resultsReleased && latestSubmitted?.score != null) {
    const settingsRow = await prisma.systemSettings.findFirst({
      select: { gradingScale: true },
    });
    const scale = parseGradingScale(settingsRow?.gradingScale);
    grade = computeGrade(latestSubmitted.score, assessment.totalMarks, scale);
  }

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

  const startExpiredMessage = startStatus === "ended";

  const startStatusBanner = startExpiredMessage ? (
    <div className="flex items-start gap-3 rounded-sm border border-red-100 bg-red-50 px-4 py-3 animate-in fade-in slide-in-from-top-2">
      <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" strokeWidth={2} />
      <div>
        <p className="text-[12px] font-bold text-red-700 uppercase tracking-wider">Assessment time has expired</p>
        <p className="text-[11px] text-red-700/80 font-semibold mt-0.5">
          This assessment window has closed. Any unfinished attempt has been
          marked as timed out.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
      {/* Page header / Back nav */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <ClipboardList size={11} />
            <span>Student</span>
            <span>›</span>
            <span>Assessments</span>
            <span>›</span>
            <span>Details</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b]">
            Assessment Details
          </h1>
        </div>
        <Link
          href="/student/assessments"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm text-[12px] font-medium text-[#323130] hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft size={13} />
          Back to Assessments
        </Link>
      </div>

      {/* Hero card */}
      <div className="bg-white border border-border rounded-sm p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: typeStyle.bg, color: typeStyle.text }}
          >
            {assessment.type}
          </span>
          {assessment.passwordProtected && (
            <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-white flex items-center gap-1">
              <Lock size={10} strokeWidth={2.5} />
              Secured
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
              Upcoming
            </span>
          )}
          {isEnded && (
            <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
              Closed
            </span>
          )}
        </div>

        <div>
          <h1 className="text-lg font-bold text-[#1e293b] leading-tight">
            {assessment.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            <BookOpen size={12} className="text-primary" strokeWidth={2} />
            {assessment.courseTitle}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="text-[#1e293b]">
              {assessment.courseCode}
            </span>
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#f1f5f9] pt-5">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Marks</span>
            <div className="flex items-center gap-1.5">
               <Award size={14} className="text-primary" strokeWidth={2} />
               <span className="text-base font-bold text-[#1e293b]">{assessment.totalMarks}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</span>
            <div className="flex items-center gap-1.5">
               <Clock size={14} className="text-primary" strokeWidth={2} />
               <span className="text-base font-bold text-[#1e293b]">
                 {assessment.durationMinutes ? `${assessment.durationMinutes}m` : "No limit"}
               </span>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attempts</span>
            <span className="block text-base font-bold text-[#1e293b] mt-0.5">
              {attempts.length} / {assessment.maxAttempts}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Questions</span>
            <span className="block text-base font-bold text-[#1e293b] mt-0.5">
              {totalQuestions}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Schedule */}
        <div className="bg-white border border-border rounded-sm p-5 space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar size={12} strokeWidth={2} className="text-primary" />
            Schedule Details
          </h2>
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-sm bg-slate-50 border border-border flex items-center justify-center text-primary">
                 <Clock size={14} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Available From</p>
                <p className="text-[12px] font-semibold text-[#1e293b]">
                  {formatDate(assessment.startsAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-sm bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                 <Lock size={14} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Closing At</p>
                <p className="text-[12px] font-semibold text-[#1e293b]">
                  {formatDate(assessment.endsAt)}
                </p>
              </div>
            </div>
            {assessment.isLocationBound && assessment.location && (
              <div className="flex items-center gap-3 pt-1">
                <div className="h-7 w-7 rounded-sm bg-slate-50 border border-border flex items-center justify-center text-slate-500">
                  <MapPin size={14} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Location Requirement</p>
                  <p className="text-[12px] font-semibold text-[#1e293b]">
                    {assessment.location}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sections */}
        {assessment.sections.length > 0 && (
          <div className="bg-white border border-border rounded-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-1.5 border-b border-border px-5 py-3 bg-slate-50/50">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#1e293b] flex items-center gap-1.5">
                <Layers size={13} className="text-primary" strokeWidth={2} />
                Structure
              </h2>
            </div>
            <div className="divide-y divide-[#f1f5f9] max-h-[300px] overflow-y-auto no-scrollbar">
              {assessment.sections.map((section) => {
                const badge = sectionTypeBadge[section.type] ?? {
                  bg: "#f1f5f9",
                  text: "#475569",
                };
                return (
                  <div
                    key={section.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-[#1e293b]">
                        {section.name}
                      </p>
                      <span
                        className="inline-block mt-0.5 rounded-sm px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {section.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-[#1e293b]">{section.questions.length}Q</p>
                      {section.requiredQuestionsCount && (
                        <p className="text-[9px] font-semibold text-muted-foreground">Ans {section.requiredQuestionsCount}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Entry / status area */}
      <div className="bg-white border border-border rounded-sm p-6">
        {startStatusBanner}
        {!studentId ? (
          <p className="text-[12px] font-semibold text-muted-foreground text-center">
            Please sign in to start this assessment.
          </p>
        ) : hasSubmitted && isLocked ? (
          <div className="flex flex-col items-center gap-4 py-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={24} strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-[#1e293b] uppercase tracking-wide">
                Submission Finalised
              </p>
              <p className="text-[12px] text-muted-foreground">
                You completed this assessment on{" "}
                <span className="text-[#1e293b] font-semibold">{latestSubmitted?.submittedAt ? formatDate(latestSubmitted.submittedAt) : "—"}</span>
              </p>
              {latestSubmitted?.status === "TIMED_OUT" && (
                <div className="mt-2 inline-block px-2.5 py-1 rounded-sm bg-red-50 border border-red-100 text-[10px] font-semibold text-red-700 uppercase tracking-wider">
                  {submissionReason === "FULLSCREEN_VIOLATION"
                    ? "Security Violation: Auto-Submitted"
                    : "Time Expiry: Auto-Submitted"}
                </div>
              )}
            </div>

            {resultsReleased && latestSubmitted?.score != null ? (
              <div className="w-full max-w-sm rounded-sm border border-emerald-200 bg-emerald-50/30 p-5 flex flex-col items-center">
                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Final Performance</p>
                <div className="mt-2 flex items-baseline gap-1">
                   <p className="text-3xl font-bold text-emerald-600">
                    {latestSubmitted.score}
                  </p>
                  <p className="text-sm font-semibold text-emerald-600/60">/ {assessment.totalMarks}</p>
                </div>
                {grade && (
                  <div className="mt-3 rounded-sm bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white">
                    Grade: {grade}
                  </div>
                )}
              </div>
            ) : !resultsReleased && hasSubmitted ? (
              <div className="rounded-sm bg-slate-50 border border-border px-4 py-2 text-[11px] font-semibold text-muted-foreground">
                Grading in progress • Results pending
              </div>
            ) : null}

            <Link
              href="/student/assessments"
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-[#1e293b] px-4 py-2 text-[12px] font-semibold text-white hover:bg-black transition-all active:scale-95"
            >
              <ChevronLeft size={14} />
              Return Home
            </Link>
          </div>
        ) : isUpcoming ? (
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-primary/20 bg-primary/5 p-5">
            <div className="h-9 w-9 bg-primary/10 rounded-sm text-primary flex items-center justify-center shrink-0">
               <AlertCircle size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1e293b] uppercase tracking-wider">Access Restricted</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                This assessment window opens on {formatDate(assessment.startsAt)}.
              </p>
            </div>
          </div>
        ) : isEnded ? (
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-border bg-slate-50 p-5 text-left w-full">
            <div className="h-9 w-9 bg-slate-200 rounded-sm text-slate-500 flex items-center justify-center shrink-0">
               <Lock size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1e293b] uppercase tracking-wider">Submission Period Over</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                This assessment was closed on {formatDate(assessment.endsAt)}.
              </p>
            </div>
          </div>
        ) : isLocked ? (
          <div className="flex flex-col items-center gap-3 text-center py-3">
             <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
               <Lock size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#1e293b] uppercase tracking-wide">Maximum attempts reached</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                You have used all available attempts ({assessment.maxAttempts}) for this assessment.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Actions
            </h2>
            {hasSubmitted && latestSubmitted && (
              <div className="flex items-start gap-3 rounded-sm border border-emerald-100 bg-emerald-50/10 p-4">
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-emerald-600 mt-0.5"
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[12px] font-bold text-[#1e293b] uppercase tracking-wider">
                    Previous Attempt Logged
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Attempt {latestSubmitted.attemptNumber} submitted on {formatDate(latestSubmitted.submittedAt!)}.
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mt-2 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm inline-block">
                    {assessment.maxAttempts - attempts.length} Attempt{assessment.maxAttempts - attempts.length !== 1 ? "s" : ""} Left
                  </p>
                </div>
              </div>
            )}

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
          </div>
        )}
      </div>
    </div>
  );
}
