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
  EXAM: { bg: "#FEE7E9", text: "#F23F42" },
  QUIZ: { bg: "#FFF4E5", text: "#F0B132" },
  ASSIGNMENT: { bg: "#E6F4EA", text: "#23A559" },
};

const sectionTypeBadge: Record<string, { bg: string; text: string }> = {
  OBJECTIVE: { bg: "#E6F4EA", text: "#23A559" },
  SUBJECTIVE: { bg: "#F1F5F9", text: "#475569" },
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
    <div className="flex items-start gap-4 rounded-xl border-2 border-[#F23F42]/20 bg-[#FEE7E9] px-5 py-4 animate-in fade-in slide-in-from-top-2">
      <AlertCircle size={20} className="shrink-0 text-[#F23F42]" strokeWidth={2.5} />
      <div>
        <p className="font-black text-[#F23F42] uppercase tracking-tight">Assessment time has expired</p>
        <p className="text-sm text-[#F23F42]/80 font-bold mt-0.5">
          This assessment window has closed. Any unfinished attempt has been
          marked as timed out.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Back nav */}
      <Link
        href="/student/assessments"
        className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-discord-blurple transition-all"
      >
        <ChevronLeft size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
        Back to Assessments
      </Link>

      {/* Hero card */}
      <div className="discord-card p-8 space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm"
            style={{ background: typeStyle.bg, color: typeStyle.text }}
          >
            {assessment.type}
          </span>
          {assessment.passwordProtected && (
            <span className="rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-sm flex items-center gap-1.5">
              <Lock size={12} strokeWidth={3} />
              Secured
            </span>
          )}
          {isUpcoming && (
            <span className="rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
              Upcoming
            </span>
          )}
          {isEnded && (
            <span className="rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-[#FEE7E9] text-[#F23F42]">
              Closed
            </span>
          )}
        </div>

        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {assessment.title}
          </h1>
          <p className="mt-3 flex items-center gap-2.5 text-sm font-bold text-slate-500 uppercase tracking-tight">
            <BookOpen size={18} className="text-discord-blurple" strokeWidth={2.5} />
            {assessment.courseTitle}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="text-slate-900">
              {assessment.courseCode}
            </span>
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-slate-100 pt-8">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Total Marks</span>
            <div className="flex items-center gap-2">
               <Award size={20} className="text-discord-blurple" strokeWidth={2.5} />
               <span className="text-2xl font-black text-slate-900">{assessment.totalMarks}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Duration</span>
            <div className="flex items-center gap-2">
               <Clock size={20} className="text-discord-blurple" strokeWidth={2.5} />
               <span className="text-2xl font-black text-slate-900">
                 {assessment.durationMinutes ? `${assessment.durationMinutes}m` : "∞"}
               </span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Attempts</span>
            <span className="block text-2xl font-black text-slate-900">
              {attempts.length} / {assessment.maxAttempts}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Questions</span>
            <span className="block text-2xl font-black text-slate-900">
              {totalQuestions}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Schedule */}
        <div className="discord-card p-6 space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            <Calendar size={14} strokeWidth={3} className="text-discord-blurple" />
            Schedule Details
          </h2>
          <div className="grid gap-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-discord-blurple">
                 <Clock size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available From</p>
                <p className="text-sm font-black text-slate-700">
                  {formatDate(assessment.startsAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#FEE7E9] flex items-center justify-center text-[#F23F42]">
                 <Lock size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Closing At</p>
                <p className="text-sm font-black text-slate-700">
                  {formatDate(assessment.endsAt)}
                </p>
              </div>
            </div>
            {assessment.isLocationBound && assessment.location && (
              <div className="flex items-center gap-4 pt-2">
                <MapPin size={20} className="text-slate-400" strokeWidth={2.5} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Requirement</p>
                  <p className="text-sm font-black text-slate-700">
                    {assessment.location}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sections */}
        {assessment.sections.length > 0 && (
          <div className="discord-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <Layers size={16} className="text-discord-blurple" strokeWidth={3} />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                Structure
              </h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto no-scrollbar">
              {assessment.sections.map((section) => {
                const badge = sectionTypeBadge[section.type] ?? {
                  bg: "#F1F5F9",
                  text: "#475569",
                };
                return (
                  <div
                    key={section.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        {section.name}
                      </p>
                      <span
                        className="inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {section.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{section.questions.length}Q</p>
                      {section.requiredQuestionsCount && (
                        <p className="text-[10px] font-bold text-slate-400">Ans {section.requiredQuestionsCount}</p>
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
      <div className="discord-card p-8">
        {startStatusBanner}
        {!studentId ? (
          <p className="text-sm font-bold text-slate-500 text-center">
            Please sign in to start this assessment.
          </p>
        ) : hasSubmitted && isLocked ? (
          <div className="flex flex-col items-center gap-6 py-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E6F4EA] shadow-xl shadow-[#23A559]/10">
              <CheckCircle2 size={40} className="text-[#23A559]" strokeWidth={3} />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Submission Finalised
              </p>
              <p className="text-sm font-bold text-slate-500">
                You completed this assessment on{" "}
                <span className="text-slate-900">{latestSubmitted?.submittedAt ? formatDate(latestSubmitted.submittedAt) : "—"}</span>
              </p>
              {latestSubmitted?.status === "TIMED_OUT" && (
                <div className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#FEE7E9] text-[11px] font-black text-[#F23F42] uppercase tracking-widest">
                  {submissionReason === "FULLSCREEN_VIOLATION"
                    ? "Security Violation: Auto-Submitted"
                    : "Time Expiry: Auto-Submitted"}
                </div>
              )}
            </div>

            {resultsReleased && latestSubmitted?.score != null ? (
              <div className="w-full max-w-sm rounded-2xl border-4 border-[#23A559]/20 bg-[#E6F4EA]/30 p-6 flex flex-col items-center shadow-inner">
                <p className="text-[10px] font-black text-[#23A559] uppercase tracking-[0.2em]">Final Performance</p>
                <div className="mt-3 flex items-baseline gap-1">
                   <p className="text-5xl font-black text-[#23A559]">
                    {latestSubmitted.score}
                  </p>
                  <p className="text-xl font-bold text-[#23A559]/60">/ {assessment.totalMarks}</p>
                </div>
                {grade && (
                  <div className="mt-4 rounded-xl bg-[#23A559] px-6 py-2 shadow-lg shadow-[#23A559]/20">
                    <p className="text-sm font-black text-white uppercase tracking-widest">
                      Grade: {grade}
                    </p>
                  </div>
                )}
              </div>
            ) : !resultsReleased && hasSubmitted ? (
              <div className="rounded-xl bg-slate-100 px-6 py-3">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Grading in progress • Results pending
                </p>
              </div>
            ) : null}

            <Link
              href="/student/assessments"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 text-sm font-black text-white hover:bg-black transition-all active:scale-95 shadow-xl shadow-black/10"
            >
              <ChevronLeft size={18} strokeWidth={3} />
              Return Home
            </Link>
          </div>
        ) : isUpcoming ? (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-discord-blurple/20 bg-discord-blurple/5 px-6 py-6 border-dashed">
            <div className="h-12 w-12 rounded-2xl bg-discord-blurple flex items-center justify-center text-white shrink-0 shadow-lg shadow-discord-blurple/20">
               <AlertCircle size={24} strokeWidth={3} />
            </div>
            <div>
              <p className="font-black text-discord-blurple uppercase tracking-tight">Access Restricted</p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                This assessment window opens on {formatDate(assessment.startsAt)}.
              </p>
            </div>
          </div>
        ) : isEnded ? (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-6 py-6 border-dashed text-center flex-col sm:flex-row">
            <div className="h-12 w-12 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
               <Lock size={24} strokeWidth={3} />
            </div>
            <div className="text-left">
              <p className="font-black text-slate-900 uppercase tracking-tight">Submission Period Over</p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                This assessment was closed on {formatDate(assessment.endsAt)}.
              </p>
            </div>
          </div>
        ) : isLocked ? (
          <div className="flex flex-col items-center gap-4 text-center">
             <div className="h-16 w-16 rounded-3xl bg-[#FEE7E9] flex items-center justify-center text-[#F23F42] shadow-lg shadow-[#F23F42]/10">
               <Lock size={32} strokeWidth={3} />
            </div>
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight text-xl">Maximum attempts reached</p>
              <p className="text-sm font-bold text-slate-500 mt-1">
                You have used all available attempts ({assessment.maxAttempts}) for this assessment.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 px-1">
              Actions
            </h2>
            {hasSubmitted && latestSubmitted && (
              <div className="flex items-start gap-4 rounded-2xl border-2 border-[#23A559]/10 bg-[#E6F4EA]/20 p-5">
                <CheckCircle2
                  size={20}
                  className="shrink-0 text-[#23A559]"
                  strokeWidth={3}
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    Previous Attempt Logged
                  </p>
                  <p className="text-[11px] font-bold text-slate-500">
                    Attempt {latestSubmitted.attemptNumber} submitted on {formatDate(latestSubmitted.submittedAt!)}.
                  </p>
                  <p className="text-[11px] font-black text-[#23A559] uppercase tracking-widest mt-2 bg-white px-2 py-0.5 rounded-md inline-block shadow-sm">
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
