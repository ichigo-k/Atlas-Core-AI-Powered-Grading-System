import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDashboardData } from "@/lib/student-queries";
import { prisma } from "@/lib/prisma";
import {
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ClipboardList,
  CalendarDays,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import LiveAlert from "./LiveAlert";
import InlineCountdown from "./InlineCountdown";
import ScoreTrend from "./ScoreTrend";
import GradeDonut from "./GradeDonut";

// ── helpers ──────────────────────────────────────────────────────────────────

function gradeColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 50) return "#F59E0B";
  if (score >= 30) return "#F97316";
  return "#EF4444";
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  EXAM:       { bg: "#fee2e2", text: "#991b1b" },
  QUIZ:       { bg: "#fef9c3", text: "#854d0e" },
  ASSIGNMENT: { bg: "#dcfce7", text: "#166534" },
};

function formatDuration(min: number | null): string {
  if (min == null) return "";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const session = await getSession();
  const displayName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Student";
  const firstName = displayName.split(" ")[0];

  const email = session?.user?.email;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;
  const studentId = user?.id ?? null;

  const data = studentId
    ? await getDashboardData(studentId)
    : {
        upcomingCount: 0,
        ongoingCount: 0,
        completedCount: 0,
        averageScore: null,
        upcomingAssessments: [],
        recentResults: [],
      };

  const {
    upcomingCount,
    ongoingCount,
    completedCount,
    averageScore,
    upcomingAssessments,
    recentResults,
    gradeDistribution,
  } = data;

  const ongoingItems = upcomingAssessments.filter((a) => a.status === "ongoing");
  const upcomingItems = upcomingAssessments.filter((a) => a.status === "upcoming");
  const nextExam = upcomingItems[0] ?? null;

  // Trend chart: oldest → newest (left → right)
  const trendBars = [...recentResults].reverse().map((r) => ({
    label: r.title.length > 10 ? r.title.slice(0, 10) : r.title,
    fullLabel: r.title,
    course: r.courseCode,
    score: r.score,
    grade: r.grade,
  }));

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isEmpty =
    upcomingCount === 0 &&
    ongoingCount === 0 &&
    completedCount === 0 &&
    recentResults.length === 0;

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <LayoutDashboard size={11} />
            <span>Home</span>
            <span>›</span>
            <span>Dashboard</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b]">
            Welcome back, {firstName}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{dateStr}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/student/assessments"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm text-[12px] font-medium text-[#323130] hover:bg-slate-50 transition-colors"
          >
            <ClipboardList size={13} />
            Assessments
          </Link>
          <Link
            href="/student/schedule"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm text-[12px] font-medium text-[#323130] hover:bg-slate-50 transition-colors"
          >
            <CalendarDays size={13} />
            Schedule
          </Link>
        </div>
      </div>

      {/* ── Live alert ── */}
      {ongoingItems.length > 0 && (
        <LiveAlert
          items={ongoingItems.map((a) => ({
            id: a.id,
            title: a.title,
            courseTitle: a.courseTitle,
            courseCode: a.courseCode,
            durationMinutes: a.durationMinutes,
            location: a.location,
            passwordProtected: a.passwordProtected,
            proctoringEnabled: a.proctoringEnabled,
          }))}
        />
      )}

      {/* ── Empty state ── */}
      {isEmpty ? (
        <div className="bg-white border border-border rounded-sm py-20 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <ClipboardList size={28} className="text-slate-300" />
          </div>
          <p className="text-[15px] font-semibold text-[#1e293b]">
            No assessments yet
          </p>
          <p className="max-w-xs text-[13px] text-muted-foreground">
            You have not been assigned to a class yet, or no assessments have
            been scheduled.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Upcoming */}
            <div className="bg-white border border-border rounded-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Upcoming
                  </p>
                  <p className="text-[26px] font-semibold text-[#1e293b] mt-1.5 leading-none">
                    {upcomingCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {nextExam
                      ? `Next: ${nextExam.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : "None scheduled"}
                  </p>
                </div>
                <div className="p-1.5 rounded bg-[#f3f2f1]">
                  <Calendar size={16} className="text-[#605e5c]" strokeWidth={1.6} />
                </div>
              </div>
            </div>

            {/* Live now */}
            <div className="bg-white border border-border rounded-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Live Now
                  </p>
                  <p
                    className="text-[26px] font-semibold mt-1.5 leading-none"
                    style={{ color: ongoingCount > 0 ? "#d13438" : "#1e293b" }}
                  >
                    {ongoingCount}
                  </p>
                  <p
                    className="text-[11px] mt-1.5"
                    style={{ color: ongoingCount > 0 ? "#d13438" : "#64748B" }}
                  >
                    {ongoingCount > 0 ? "Active session" : "None active"}
                  </p>
                </div>
                <div className="p-1.5 rounded bg-[#f3f2f1]">
                  <AlertCircle
                    size={16}
                    strokeWidth={1.6}
                    style={{ color: ongoingCount > 0 ? "#d13438" : "#605e5c" }}
                  />
                </div>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white border border-border rounded-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Completed
                  </p>
                  <p className="text-[26px] font-semibold text-[#1e293b] mt-1.5 leading-none">
                    {completedCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    This semester
                  </p>
                </div>
                <div className="p-1.5 rounded bg-[#f3f2f1]">
                  <CheckCircle2 size={16} className="text-[#605e5c]" strokeWidth={1.6} />
                </div>
              </div>
            </div>

            {/* Average score */}
            <div className="bg-white border border-border rounded-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Average Score
                  </p>
                  <p className="text-[26px] font-semibold text-[#1e293b] mt-1.5 leading-none">
                    {averageScore != null
                      ? `${averageScore.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p
                    className="text-[11px] mt-1.5"
                    style={{
                      color:
                        averageScore != null && averageScore >= 50
                          ? "#107c10"
                          : averageScore != null
                          ? "#d13438"
                          : "#64748B",
                    }}
                  >
                    {averageScore != null && averageScore >= 50
                      ? "Passing average"
                      : averageScore != null
                      ? "Below passing"
                      : "No data yet"}
                  </p>
                </div>
                <div className="p-1.5 rounded bg-[#f3f2f1]">
                  <TrendingUp size={16} className="text-[#605e5c]" strokeWidth={1.6} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Score trend + Grade donut ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score trend — spans 2 cols */}
            <div className="md:col-span-2 bg-white border border-border rounded-sm">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-[#1e293b]">
                    Score Trend
                  </span>
                </div>
                {averageScore != null && (
                  <span className="text-[15px] font-bold text-primary">
                    {averageScore.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="px-5 py-4">
                <ScoreTrend results={trendBars} average={null} />
              </div>
            </div>

            {/* Grade distribution donut */}
            <div className="bg-white border border-border rounded-sm">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-[#1e293b]">
                  Grades
                </span>
              </div>
              <div className="px-5 py-4">
                <GradeDonut distribution={gradeDistribution} total={completedCount} />
              </div>
            </div>
          </div>

          {/* ── Bottom row: upcoming list + recent results ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Upcoming assessments (spans 2/3 on desktop) */}
            <div className="lg:col-span-2 bg-white border border-border rounded-sm">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-primary" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-[#1e293b]">
                    Upcoming Assessments
                  </span>
                </div>
                <Link
                  href="/student/assessments"
                  className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                >
                  See all <ArrowRight size={12} />
                </Link>
              </div>

              {upcomingAssessments.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                  No upcoming assessments.
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {upcomingAssessments.map((a, idx) => {
                    const isLive = a.status === "ongoing";
                    const isNext = !isLive && idx === upcomingAssessments.findIndex(x => x.status === "upcoming");
                    const style =
                      TYPE_BADGE[a.type] ?? { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Left stripe */}
                        <div
                          className="w-[3px] h-10 rounded-sm flex-shrink-0"
                          style={{ background: isLive ? "#EF4444" : "#002388" }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[13px] text-[#1e293b] truncate">
                              {a.title}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em] flex-shrink-0"
                              style={{ background: style.bg, color: style.text }}
                            >
                              {a.type}
                            </span>
                            {isLive && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Live
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-[#1e293b] uppercase tracking-wide text-[10px]">
                              {a.courseCode}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {a.startsAt.toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {a.durationMinutes != null && (
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatDuration(a.durationMinutes)}
                              </span>
                            )}
                            {a.location && (
                              <span className="hidden sm:flex items-center gap-1 max-w-[140px] truncate">
                                <MapPin size={10} />
                                {a.location}
                              </span>
                            )}
                            {isNext && (
                              <InlineCountdown targetDate={a.startsAt.toISOString()} />
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/student/assessments/${a.id}`}
                          className={[
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold flex-shrink-0 transition-colors",
                            isLive
                              ? "bg-primary text-white hover:bg-[#001570]"
                              : "border border-border text-[#323130] hover:bg-slate-50",
                          ].join(" ")}
                        >
                          {isLive ? "Enter" : "View"}
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent results (1/3 on desktop) */}
            <div className="bg-white border border-border rounded-sm">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-primary" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-[#1e293b]">
                    Recent Results
                  </span>
                </div>
                <Link
                  href="/student/assessments"
                  className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                >
                  All <ArrowRight size={12} />
                </Link>
              </div>

              {recentResults.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                  No results yet.
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {recentResults.map((r) => {
                    const color = gradeColor(r.score);
                    return (
                      <div
                        key={r.id}
                        className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#1e293b] truncate">
                              {r.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {r.courseTitle}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p
                              className="text-[14px] font-bold"
                              style={{ color }}
                            >
                              {r.score.toFixed(1)}%
                            </p>
                            <p
                              className="text-[11px] font-semibold"
                              style={{ color }}
                            >
                              {r.grade}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(r.score, 100)}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
