import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDashboardData } from "@/lib/student-queries";
import { prisma } from "@/lib/prisma";
import {
  Calendar,
  Clock,
  ArrowRight,
  ClipboardList,
  CalendarDays,
  ChevronRight,
  BarChart2,
  MapPin,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  BookOpen,
  User,
} from "lucide-react";
import LiveAlert from "./LiveAlert";
import InlineCountdown from "./InlineCountdown";

function gradeColor(score: number): string {
  if (score >= 50) return "#107c10";
  return "#d83b01";
}

function formatDuration(min: number | null): string {
  if (min == null) return "";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function StudentDashboardPage() {
  const session = await getSession();
  const displayName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Student";
  const firstName = displayName.split(" ")[0];

  const email = session?.user?.email;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;
  const studentId = user?.id ?? null;

  const data = studentId
    ? await getDashboardData(studentId)
    : { upcomingCount: 0, ongoingCount: 0, completedCount: 0, averageScore: null, upcomingAssessments: [], recentResults: [], gradeDistribution: {} };

  const {
    upcomingCount, ongoingCount, completedCount,
    averageScore, upcomingAssessments, recentResults,
  } = data;

  const ongoingItems = upcomingAssessments.filter((a) => a.status === "ongoing");
  const upcomingItems = upcomingAssessments.filter((a) => a.status === "upcoming");
  const nextExam = upcomingItems[0] ?? null;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const isEmpty =
    upcomingCount === 0 && ongoingCount === 0 &&
    completedCount === 0 && recentResults.length === 0;

  const stats = [
    {
      label: "Upcoming",
      value: upcomingCount,
      sub: nextExam
        ? nextExam.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "None scheduled",
      Icon: Calendar,
      accent: "#002388",
      chip: "from-[#002388] to-[#1746c4]",
    },
    {
      label: "Live Now",
      value: ongoingCount,
      sub: ongoingCount > 0 ? "Exam in progress" : "None active",
      Icon: AlertCircle,
      live: ongoingCount > 0,
      accent: "#d13438",
      chip: "from-[#d13438] to-[#e85a5e]",
    },
    {
      label: "Completed",
      value: completedCount,
      sub: "This semester",
      Icon: CheckCircle2,
      accent: "#107c10",
      chip: "from-[#107c10] to-[#2aa02a]",
    },
    {
      label: "Avg Score",
      value: averageScore != null ? `${averageScore.toFixed(1)}%` : "—",
      sub: averageScore != null
        ? averageScore >= 50 ? "Passing average" : "Below passing"
        : "No results yet",
      Icon: TrendingUp,
      accent: "#ca8a04",
      chip: "from-[#b8860b] to-[#e0a82e]",
    },
  ];

  const quickLinks = [
    { label: "All assessments", description: "Live, upcoming, and completed", href: "/student/assessments", Icon: ClipboardList },
    { label: "My schedule", description: "Assessment dates and times", href: "/student/schedule", Icon: CalendarDays },
    { label: "My grades", description: "Performance and score history", href: "/student/grades", Icon: BarChart2 },
  ];

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">

      {/* ── Command bar ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LayoutDashboard size={11} />
        <span>Student</span>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium">Dashboard</span>
      </div>

      <div className="px-4 py-5 md:px-6 lg:px-8 pb-12 max-w-[1280px] space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-1">{dateStr}</p>
            <h1 className="text-xl font-semibold text-[#1e293b]">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {ongoingCount > 0
                ? nextExam
                  ? <>Next exam: <span className="font-medium text-[#1e293b]">{nextExam.title}</span>{" — "}<InlineCountdown targetDate={nextExam.startsAt.toISOString()} /></>
                  : "Check your assessments for live exams."
                : nextExam
                  ? <>Next exam: <span className="font-medium text-[#1e293b]">{nextExam.title}</span>{" — "}<InlineCountdown targetDate={nextExam.startsAt.toISOString()} /></>
                  : completedCount > 0
                    ? "You're all caught up. Well done."
                    : "No assessments have been scheduled yet."}
            </p>
          </div>
        </div>


        {isEmpty ? (
          <div className="rounded-sm border border-border bg-white py-20 flex flex-col items-center gap-3 text-center">
            <ClipboardList size={32} className="text-slate-300" />
            <p className="text-[15px] font-semibold text-[#1e293b]">No assessments yet</p>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              You haven't been assigned to a class yet, or no assessments have been scheduled.
            </p>
          </div>
        ) : (
          <>
            {/* ── Stat tiles ── */}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ label, value, sub, Icon, live }) => (
                <div key={label} className="relative rounded-sm border border-border bg-white p-4 overflow-hidden transition-colors hover:bg-slate-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#dbeafe] text-[#002388]">
                      <Icon size={20} />
                    </div>
                    {live && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-[26px] font-semibold leading-none text-[#1e293b]">{value}</p>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
                </div>
              ))}
            </section>

            {/* ── Middle row ── */}
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">

              {/* Upcoming assessments */}
              <section className="rounded-md border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[#1e293b]">Upcoming assessments</h2>
                    <p className="text-[12px] text-muted-foreground">Live and scheduled exams, quizzes, and assignments.</p>
                  </div>
                  <Link href="/student/assessments" className="text-[12px] font-medium text-[#002388] hover:underline flex-shrink-0">
                    See all
                  </Link>
                </div>

                {upcomingAssessments.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">Nothing scheduled right now.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...upcomingAssessments].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).slice(0, 3).map((a, idx) => {
                      const isLive = a.status === "ongoing";
                      const isNext = !isLive && idx === 0;
                      return (
                        <div
                          key={a.id}
                          className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center md:px-5 transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 truncate">{a.title}</span>
                              {/* type badge — neutral only */}
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide bg-slate-100 text-slate-500 flex-shrink-0">
                                {a.type}
                              </span>
                              {isLive && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-[#d83b01] flex-shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#d83b01] animate-pulse" />
                                  Live
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                              <span className="font-semibold text-[#002388] uppercase text-[10px]">{a.courseCode}</span>
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {a.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              {a.durationMinutes != null && (
                                <span className="flex items-center gap-1"><Clock size={10} />{formatDuration(a.durationMinutes)}</span>
                              )}
                              {a.location && (
                                <span className="hidden sm:flex items-center gap-1 truncate max-w-[100px]">
                                  <MapPin size={10} />{a.location}
                                </span>
                              )}
                              {isNext && <InlineCountdown targetDate={a.startsAt.toISOString()} />}
                            </div>
                          </div>
                          <Link
                            href={`/student/assessments/${a.id}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-sm flex-shrink-0 transition-colors ${isLive
                              ? "bg-[#ffb900] text-[#1e293b] hover:bg-[#e6a700]"
                              : "border border-border text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            {isLive ? "Enter" : "View"}
                            <ArrowRight size={10} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Quick links — yellow icon hover */}
              <section className="rounded-md border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <div className="border-b border-border px-4 py-3 md:px-5">
                  <h2 className="text-[13px] font-semibold text-[#1e293b]">Quick navigation</h2>
                  <p className="text-[12px] text-muted-foreground">Jump to any section.</p>
                </div>
                <div className="grid gap-3 p-4 md:p-5">
                  {quickLinks.map(({ label, description, href, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group rounded-md border border-border bg-white p-4 transition-all duration-200 hover:border-[#c7d0e0] hover:bg-slate-50 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-slate-500 group-hover:bg-[#fff8e1] group-hover:text-[#92400e] transition-colors">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                            <ArrowRight size={14} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#92400e]" />
                          </div>
                          <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            {/* ── Recent results ── */}
            {recentResults.length > 0 && (
              <section className="rounded-md border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#fff8e1] text-[#92400e]">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-semibold text-[#1e293b]">Recent results</h2>
                      <p className="text-[12px] text-muted-foreground">Your latest graded assessments.</p>
                    </div>
                  </div>
                  <Link href="/student/grades" className="text-sm font-medium text-[#002388] hover:underline">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-slate-100">
                  {recentResults.slice(0, 5).map((r) => {
                    const color = gradeColor(r.score);
                    return (
                      <div key={r.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_auto] md:items-center md:px-5 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{r.title}</p>
                          <p className="mt-0.5 text-[12px] text-slate-500">{r.courseTitle}</p>
                        </div>
                        {/* score bar — yellow fill */}
                        <div className="hidden md:block">
                          <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(r.score, 100)}%`, background: "#ffb900" }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:justify-end">
                          <span className="text-[13px] font-bold tabular-nums text-[#1e293b]">{r.score.toFixed(1)}%</span>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ color, borderColor: color + "40", background: color + "12" }}
                          >
                            {r.grade}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
