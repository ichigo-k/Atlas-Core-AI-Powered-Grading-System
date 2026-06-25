import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getGradesData } from "@/lib/grades-queries";
import {
  BarChart2,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  ArrowRight,
  ClipboardList,
  Minus,
  TrendingDown,
} from "lucide-react";
import GradesTrendChart from "./GradesTrendChart";

function gradeColor(pct: number): string {
  if (pct >= 70) return "#107c10";
  if (pct >= 50) return "#ca5010";
  if (pct >= 30) return "#d83b01";
  return "#a4262c";
}

function gradeAccentClass(pct: number): string {
  if (pct >= 70) return "bg-green-50 text-green-700 border-green-200";
  if (pct >= 50) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  EXAM: { bg: "#fde7e9", text: "#a4262c" },
  QUIZ: { bg: "#fff4ce", text: "#7a4f00" },
  ASSIGNMENT: { bg: "#dff6dd", text: "#107c10" },
};

export default async function GradesPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  });
  if (!user) redirect("/");

  const data = await getGradesData(user.id);
  const { overallAvg, overallGrade, totalCompleted, courseBreakdown, trendPoints } = data;

  const isEmpty = totalCompleted === 0;

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">

      {/* -- Command bar -- */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <BarChart2 size={11} />
        <span>Student</span>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium">My Grades</span>
      </div>

      <div className="px-4 py-5 md:px-6 lg:px-8 space-y-5 pb-12 max-w-[1280px]">

        {/* -- Page header -- */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#1e293b]">My Performance</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Scores from graded assessments released in this portal.
            </p>
          </div>
          <Link
            href="/student/assessments"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1e293b] bg-white hover:bg-slate-50 border border-border rounded-sm transition-colors"
          >
            <ClipboardList size={13} className="text-[#002388]" />
            All assessments
          </Link>
        </div>

        {isEmpty ? (
          <div className="bg-white border border-border rounded-md py-20 flex flex-col items-center gap-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
            <BarChart2 size={32} className="text-[#c8c6c4]" />
            <p className="text-[15px] font-semibold text-[#1e293b]">No results yet</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              Grades will appear here once your lecturer releases results for a completed assessment.
            </p>
            <Link
              href="/student/assessments"
              className="mt-2 flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#002388] hover:bg-[#001a66] rounded transition-colors"
            >
              View assessments <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <>
            {/* -- Summary strip -- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Overall avg */}
              <div className="bg-white border border-border rounded-md p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)] flex items-center gap-4">
                {(() => {
                  const pct = overallAvg ?? 0;
                  const r = 26, c = 2 * Math.PI * r;
                  const col = gradeColor(pct);
                  return (
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                        <circle cx="32" cy="32" r={r} fill="none" stroke="#eef0f3" strokeWidth="6" />
                        <circle
                          cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="6"
                          strokeLinecap="round" strokeDasharray={c}
                          strokeDashoffset={c * (1 - pct / 100)}
                        />
                      </svg>
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums"
                        style={{ color: col }}
                      >
                        {overallAvg != null ? `${overallAvg}%` : "-"}
                      </span>
                    </div>
                  );
                })()}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Portal Average</p>
                  <p className="text-[26px] font-bold text-[#1e293b] leading-none mt-1">
                    {overallGrade ?? "-"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Across {totalCompleted} graded assessment{totalCompleted !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Best course */}
              <div className="bg-white border border-border rounded-md p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Best Course</p>
                {courseBreakdown[0] ? (
                  <>
                    <p className="text-[13px] font-semibold text-[#1e293b] truncate">{courseBreakdown[0].courseTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[20px] font-bold" style={{ color: gradeColor(courseBreakdown[0].avgScore) }}>
                        {courseBreakdown[0].avgGrade}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{courseBreakdown[0].avgScore}%</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-muted-foreground">-</p>
                )}
              </div>

              {/* Courses graded */}
              <div className="bg-white border border-border rounded-md p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Courses with Results</p>
                <p className="text-[28px] font-bold text-[#1e293b] leading-none">{courseBreakdown.length}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {courseBreakdown.filter((c) => c.avgScore >= 50).length} passing
                </p>
              </div>
            </div>

            {/* -- Trend chart -- */}
            {trendPoints.length >= 2 && (
              <div className="bg-white border border-border rounded-md overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#dbeafe]">
                      <TrendingUp size={16} className="text-[#002388]" />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-semibold text-[#1e293b]">Score Trend</h2>
                      <p className="text-[11px] text-muted-foreground">
                        Your last {trendPoints.length} graded assessments
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-6">
                  <GradesTrendChart points={trendPoints} />
                </div>
              </div>
            )}

            {/* -- Course breakdown -- */}
            <div className="bg-white border border-border rounded-md overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-slate-50">
                <BookOpen size={14} className="text-[#002388]" />
                <span className="text-[13px] font-semibold text-[#1e293b]">Course Breakdown</span>
              </div>

              <div className="divide-y divide-[#f8f9fa]">
                {courseBreakdown.map((course) => (
                  <details key={course.courseId} className="group">
                    <summary className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fa] cursor-pointer list-none transition-colors">
                      {/* Expand chevron */}
                      <ChevronRight size={14} className="text-muted-foreground transition-transform group-open:rotate-90 flex-shrink-0" />

                      {/* Course info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-[#002388] uppercase tracking-wide">
                            {course.courseCode}
                          </span>
                          <span className="text-[13px] font-semibold text-[#1e293b] truncate">
                            {course.courseTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="h-1.5 w-32 bg-[#f8f9fa] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(course.avgScore, 100)}%`,
                                background: gradeColor(course.avgScore),
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {course.assessments.length} assessment{course.assessments.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {/* Grade */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[13px] font-bold" style={{ color: gradeColor(course.avgScore) }}>
                          {course.avgScore}%
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border ${gradeAccentClass(course.avgScore)}`}
                        >
                          {course.avgGrade}
                        </span>
                      </div>
                    </summary>

                    {/* Expanded: individual assessments */}
                    <div className="bg-slate-50/60 border-t border-[#f1f5f9] divide-y divide-[#f1f5f9]">
                      {course.assessments.map((a) => {
                        const pct = a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0;
                        const typeBadge = TYPE_BADGE[a.type] ?? { bg: "#f8f9fa", text: "#605e5c" };
                        return (
                          <div key={a.id} className="flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-[#f8f9fa] transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-medium text-[#1e293b] truncate">{a.title}</span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase"
                                  style={{ background: typeBadge.bg, color: typeBadge.text }}
                                >
                                  {a.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="hidden sm:flex items-center gap-1.5">
                                <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(pct, 100)}%`, background: gradeColor(pct) }}
                                  />
                                </div>
                                <span className="text-[11px] text-muted-foreground w-9 text-right">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <span className="text-[12px] font-bold" style={{ color: gradeColor(pct) }}>
                                {a.grade}
                              </span>
                              <Link
                                href={`/student/assessments/${a.id}/results`}
                                className="text-[11px] text-[#002388] hover:underline flex items-center gap-0.5"
                              >
                                Review <ArrowRight size={10} />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
