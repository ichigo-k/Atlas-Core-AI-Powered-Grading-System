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
  MapPin,
  ChevronRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import LiveAlert from "./LiveAlert";
import InlineCountdown from "./InlineCountdown";
import ScoreTrend from "./ScoreTrend";
import GradeDonut from "./GradeDonut";

// ── helpers ──────────────────────────────────────────────────────────────────

function gradeColor(score: number): string {
  if (score >= 70) return "#107c10";
  if (score >= 50) return "#ca5010";
  if (score >= 30) return "#d83b01";
  return "#a4262c";
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  EXAM: { bg: "#fde7e9", text: "#a4262c" },
  QUIZ: { bg: "#fff4ce", text: "#7a4f00" },
  ASSIGNMENT: { bg: "#dff6dd", text: "#107c10" },
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
    <div className="bg-[#F8F9FA] min-h-full">

      {/* ── Page command bar ── */}
      <div className="bg-white border-b border-[#edebe9] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[12px] text-[#605e5c] mb-0.5">
            <span>Home</span>
            <ChevronRight size={12} />
            <span className="text-[#0078d4] font-medium">Dashboard</span>
          </div>
          <h1 className="text-[18px] font-semibold text-[#323130]">
            {firstName}&apos;s Dashboard
          </h1>
          <p className="text-[11px] text-[#605e5c] mt-0.5">{dateStr}</p>
        </div>

        {/* Command bar buttons — Azure style */}
        <div className="flex items-center gap-1">
          <Link
            href="/student/assessments"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#323130] hover:bg-[#F8F9FA] border border-transparent hover:border-[#8a8886] rounded transition-colors"
          >
            <Plus size={14} className="text-[#0078d4]" />
            New attempt
          </Link>
          <Link
            href="/student/schedule"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#323130] hover:bg-[#F8F9FA] border border-transparent hover:border-[#8a8886] rounded transition-colors"
          >
            <CalendarDays size={14} className="text-[#0078d4]" />
            Schedule
          </Link>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#323130] hover:bg-[#F8F9FA] border border-transparent hover:border-[#8a8886] rounded transition-colors">
            <RefreshCw size={13} className="text-[#605e5c]" />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 space-y-4 pb-12 max-w-[1280px]">

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
          <div className="bg-white border border-[#edebe9] rounded py-20 flex flex-col items-center gap-3 text-center">
            <ClipboardList size={32} className="text-[#c8c6c4]" />
            <p className="text-[15px] font-semibold text-[#323130]">No assessments yet</p>
            <p className="max-w-xs text-[13px] text-[#605e5c]">
              You have not been assigned to a class yet, or no assessments have been scheduled.
            </p>
          </div>
        ) : (
          <>
            {/* ── KPI metric tiles (Modern high-fidelity cards) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Upcoming */}
              <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/50">
                    <Calendar size={18} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Upcoming
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
                  {upcomingCount}
                </p>
                <p className="text-[12px] text-slate-500 font-medium mt-1">
                  {nextExam
                    ? `Next: ${nextExam.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : "None scheduled"}
                </p>
              </div>

              {/* Live now */}
              <div
                className={`relative overflow-hidden bg-white border border-slate-200 rounded-xl p-5 transition-all duration-300 group ${ongoingCount > 0
                  ? "hover:border-emerald-300 hover:bg-emerald-50/20"
                  : "hover:border-emerald-300"
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${ongoingCount > 0
                      ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                      : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                  >
                    <AlertCircle size={18} />
                  </div>
                  {ongoingCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200/50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Live Now
                    </span>
                  )}
                </div>
                <p
                  className={`text-3xl font-extrabold tracking-tight leading-none mb-1 ${ongoingCount > 0 ? "text-emerald-700" : "text-slate-800"
                    }`}
                >
                  {ongoingCount}
                </p>
                <p
                  className={`text-[12px] font-medium mt-1 ${ongoingCount > 0 ? "text-emerald-800/80" : "text-slate-500"
                    }`}
                >
                  {ongoingCount > 0 ? "Exam in progress" : "None active"}
                </p>
              </div>

              {/* Completed */}
              <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600 border border-green-100/50">
                    <CheckCircle2 size={18} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Completed
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
                  {completedCount}
                </p>
                <p className="text-[12px] text-slate-500 font-medium mt-1">This semester</p>
              </div>

              {/* Average score */}
              <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/50">
                    <TrendingUp size={18} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Avg Score
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
                  {averageScore != null ? `${averageScore.toFixed(1)}%` : "—"}
                </p>
                <p
                  className={`text-[12px] font-semibold mt-1 ${averageScore != null && averageScore >= 50
                    ? "text-emerald-600"
                    : averageScore != null
                      ? "text-rose-600"
                      : "text-slate-500"
                    }`}
                >
                  {averageScore != null && averageScore >= 50
                    ? "Passing average"
                    : averageScore != null
                      ? "Below passing"
                      : "No data yet"}
                </p>
              </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Score Trend Accent Card (Slate-900 with Gold accents) */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
                <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between bg-slate-800/60">
                  <span className="text-[13px] font-bold text-slate-100">Score Trend</span>
                  {averageScore != null && (
                    <span className="text-[11px] text-[#FFCC00] bg-[#FFCC00]/10 border border-[#FFCC00]/30 px-2 py-0.5 rounded-full font-semibold">
                      {averageScore.toFixed(1)}% avg
                    </span>
                  )}
                </div>
                <div className="px-4 py-4 bg-slate-900">
                  <ScoreTrend results={trendBars} average={null} darkMode={true} />
                </div>
              </div>

              {/* Grade Distribution Card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[13px] font-semibold text-slate-700">Grade Distribution</span>
                </div>
                <div className="px-4 py-4">
                  <GradeDonut distribution={gradeDistribution} total={completedCount} />
                </div>
              </div>
            </div>

            {/* ── Bottom row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Upcoming assessments */}
              <div className="lg:col-span-2 bg-white border border-[#edebe9] rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
                  <span className="text-[13px] font-semibold text-[#323130]">Upcoming Assessments</span>
                  <Link
                    href="/student/assessments"
                    className="flex items-center gap-1 text-[12px] text-[#0078d4] hover:underline font-medium"
                  >
                    See all <ArrowRight size={11} />
                  </Link>
                </div>

                {upcomingAssessments.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-[#605e5c]">
                    No upcoming assessments.
                  </div>
                ) : (
                  <div className="divide-y divide-[#edebe9]">
                    {upcomingAssessments.map((a, idx) => {
                      const isLive = a.status === "ongoing";
                      const isNext = !isLive && idx === upcomingAssessments.findIndex(x => x.status === "upcoming");
                      const style = TYPE_BADGE[a.type] ?? { bg: "#F8F9FA", text: "#605e5c" };
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F8F9FA] transition-colors ${isLive ? "border-l-2 border-[#a4262c]" : "border-l-2 border-transparent hover:border-[#0078d4]"
                            }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[13px] text-[#323130] truncate">
                                {a.title}
                              </span>
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase"
                                style={{ background: style.bg, color: style.text }}
                              >
                                {a.type}
                              </span>
                              {isLive && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#a4262c]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#a4262c] animate-pulse" />
                                  Live
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[11px] text-[#605e5c]">
                              <span className="font-semibold text-[#0078d4] text-[10px] uppercase">
                                {a.courseCode}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {a.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
                              "flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold rounded flex-shrink-0 transition-colors",
                              isLive
                                ? "bg-[#a4262c] text-white hover:bg-[#8c1f24]"
                                : "border border-[#8a8886] text-[#323130] hover:bg-[#F8F9FA]",
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

              {/* Recent results */}
              <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
                  <span className="text-[13px] font-semibold text-[#323130]">Recent Results</span>
                  <Link
                    href="/student/assessments"
                    className="flex items-center gap-1 text-[12px] text-[#0078d4] hover:underline font-medium"
                  >
                    All <ArrowRight size={11} />
                  </Link>
                </div>

                {recentResults.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-[#605e5c]">
                    No results yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#edebe9]">
                    {recentResults.map((r) => {
                      const color = gradeColor(r.score);
                      return (
                        <div key={r.id} className="px-4 py-3 hover:bg-[#F8F9FA] transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[#323130] truncate">{r.title}</p>
                              <p className="text-[11px] text-[#605e5c] mt-0.5">{r.courseTitle}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[14px] font-bold" style={{ color }}>
                                {r.score.toFixed(1)}%
                              </p>
                              <p className="text-[11px] font-semibold" style={{ color }}>
                                {r.grade}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 h-[3px] bg-[#F8F9FA] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(r.score, 100)}%`, background: color }}
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
    </div>
  );
}
