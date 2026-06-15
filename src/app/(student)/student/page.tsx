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
  EXAM:       { bg: "#fde7e9", text: "#a4262c" },
  QUIZ:       { bg: "#fff4ce", text: "#7a4f00" },
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
            {/* ── KPI metric tiles (Azure "essentials" style) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Upcoming */}
              <div className="bg-white border border-[#edebe9] rounded p-4 hover:border-[#0078d4] transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Calendar size={15} className="text-[#0078d4]" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wide">
                    Upcoming
                  </span>
                </div>
                <p className="text-[32px] font-semibold text-[#323130] leading-none mb-1">
                  {upcomingCount}
                </p>
                <p className="text-[11px] text-[#605e5c]">
                  {nextExam
                    ? `Next: ${nextExam.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : "None scheduled"}
                </p>
                <div className="mt-3 h-[2px] bg-[#F8F9FA] group-hover:bg-[#0078d4] transition-colors" />
              </div>

              {/* Live now */}
              <div
                className={`bg-white border rounded p-4 transition-colors ${
                  ongoingCount > 0 ? "border-[#a4262c]" : "border-[#edebe9] hover:border-[#0078d4]"
                } group`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <AlertCircle size={15} style={{ color: ongoingCount > 0 ? "#a4262c" : "#0078d4" }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wide">
                    Live Now
                  </span>
                  {ongoingCount > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#a4262c]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#a4262c] animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
                <p
                  className="text-[32px] font-semibold leading-none mb-1"
                  style={{ color: ongoingCount > 0 ? "#a4262c" : "#323130" }}
                >
                  {ongoingCount}
                </p>
                <p className="text-[11px] text-[#605e5c]">
                  {ongoingCount > 0 ? "Exam in progress" : "None active"}
                </p>
                <div className="mt-3 h-[2px]" style={{ background: ongoingCount > 0 ? "#a4262c" : "#F8F9FA" }} />
              </div>

              {/* Completed */}
              <div className="bg-white border border-[#edebe9] rounded p-4 hover:border-[#0078d4] transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <CheckCircle2 size={15} className="text-[#107c10]" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wide">
                    Completed
                  </span>
                </div>
                <p className="text-[32px] font-semibold text-[#323130] leading-none mb-1">
                  {completedCount}
                </p>
                <p className="text-[11px] text-[#605e5c]">This semester</p>
                <div className="mt-3 h-[2px] bg-[#F8F9FA] group-hover:bg-[#107c10] transition-colors" />
              </div>

              {/* Average score */}
              <div className="bg-white border border-[#edebe9] rounded p-4 hover:border-[#0078d4] transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <TrendingUp size={15} className="text-[#0078d4]" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wide">
                    Avg Score
                  </span>
                </div>
                <p className="text-[32px] font-semibold text-[#323130] leading-none mb-1">
                  {averageScore != null ? `${averageScore.toFixed(1)}%` : "—"}
                </p>
                <p
                  className="text-[11px]"
                  style={{
                    color: averageScore != null && averageScore >= 50 ? "#107c10" : averageScore != null ? "#a4262c" : "#605e5c",
                  }}
                >
                  {averageScore != null && averageScore >= 50
                    ? "Passing average"
                    : averageScore != null
                    ? "Below passing"
                    : "No data yet"}
                </p>
                <div className="mt-3 h-[2px] bg-[#F8F9FA] group-hover:bg-[#0078d4] transition-colors" />
              </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 bg-white border border-[#edebe9] rounded">
                <div className="px-4 py-3 border-b border-[#edebe9] flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#323130]">Score Trend</span>
                  {averageScore != null && (
                    <span className="text-[12px] text-[#0078d4] font-semibold">
                      {averageScore.toFixed(1)}% avg
                    </span>
                  )}
                </div>
                <div className="px-4 py-4">
                  <ScoreTrend results={trendBars} average={null} />
                </div>
              </div>

              <div className="bg-white border border-[#edebe9] rounded">
                <div className="px-4 py-3 border-b border-[#edebe9]">
                  <span className="text-[13px] font-semibold text-[#323130]">Grade Distribution</span>
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
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F8F9FA] transition-colors ${
                            isLive ? "border-l-2 border-[#a4262c]" : "border-l-2 border-transparent hover:border-[#0078d4]"
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
