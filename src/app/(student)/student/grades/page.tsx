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
  EXAM:       { bg: "#fde7e9", text: "#a4262c" },
  QUIZ:       { bg: "#fff4ce", text: "#7a4f00" },
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
    <div className="bg-[#f8f9fa] min-h-full">

      {/* ── Command bar ── */}
      <div className="bg-white border-b border-[#edebe9] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-[#8a8886] mb-0.5">
            <span>Student</span>
            <ChevronRight size={11} />
            <span className="text-[#002388] font-medium">My Grades</span>
          </div>
          <h1 className="text-[17px] font-semibold text-[#323130]">My Performance</h1>
          <p className="text-[11px] text-[#8a8886] mt-0.5">
            Scores from graded assessments released in this portal.
          </p>
        </div>
        <Link
          href="/student/assessments"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#323130] hover:bg-[#f8f9fa] border border-transparent hover:border-[#8a8886] rounded transition-colors"
        >
          <ClipboardList size={13} className="text-[#002388]" />
          All assessments
        </Link>
      </div>

      <div className="px-4 py-4 md:px-6 space-y-4 pb-12 max-w-[1280px]">

        {isEmpty ? (
          <div className="bg-white border border-[#edebe9] rounded py-20 flex flex-col items-center gap-3 text-center">
            <BarChart2 size={32} className="text-[#c8c6c4]" />
            <p className="text-[15px] font-semibold text-[#323130]">No results yet</p>
            <p className="max-w-sm text-[13px] text-[#8a8886]">
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
            {/* ── Summary strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Overall avg */}
              <div className="bg-white border border-[#edebe9] rounded p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border-4 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: gradeColor(overallAvg ?? 0) }}>
                  <span className="text-[18px] font-bold" style={{ color: gradeColor(overallAvg ?? 0) }}>
                    {overallAvg != null ? `${overallAvg}%` : "—"}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8886]">Portal Average</p>
                  <p className="text-[22px] font-bold text-[#323130] leading-none mt-0.5">
                    {overallGrade ?? "—"}
                  </p>
                  <p className="text-[11px] text-[#8a8886] mt-0.5">
                    Across {totalCompleted} graded assessment{totalCompleted !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Best course */}
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8886] mb-2">Best Course</p>
                {courseBreakdown[0] ? (
                  <>
                    <p className="text-[13px] font-semibold text-[#323130] truncate">{courseBreakdown[0].courseTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[20px] font-bold" style={{ color: gradeColor(courseBreakdown[0].avgScore) }}>
                        {courseBreakdown[0].avgGrade}
                      </span>
                      <span className="text-[12px] text-[#8a8886]">{courseBreakdown[0].avgScore}%</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[#8a8886]">—</p>
                )}
              </div>

              {/* Courses graded */}
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8886] mb-2">Courses with Results</p>
                <p className="text-[28px] font-bold text-[#323130] leading-none">{courseBreakdown.length}</p>
                <p className="text-[11px] text-[#8a8886] mt-1">
                  {courseBreakdown.filter((c) => c.avgScore >= 50).length} passing
                </p>
              </div>
            </div>

            {/* ── Trend chart ── */}
            {trendPoints.length >= 2 && (
              <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-[#edebe9] flex items-center gap-2 bg-[#faf9f8]">
                  <TrendingUp size={14} className="text-[#002388]" />
                  <span className="text-[13px] font-semibold text-[#323130]">Score Trend</span>
                  <span className="text-[11px] text-[#8a8886]">— last {trendPoints.length} graded assessments</span>
                </div>
                <div className="px-4 py-4">
                  <GradesTrendChart points={trendPoints} />
                </div>
              </div>
            )}

            {/* ── Course breakdown ── */}
            <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-[#edebe9] flex items-center gap-2 bg-[#faf9f8]">
                <BookOpen size={14} className="text-[#002388]" />
                <span className="text-[13px] font-semibold text-[#323130]">Course Breakdown</span>
              </div>

              <div className="divide-y divide-[#f8f9fa]">
                {courseBreakdown.map((course) => (
                  <details key={course.courseId} className="group">
                    <summary className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fa] cursor-pointer list-none transition-colors">
                      {/* Expand chevron */}
                      <ChevronRight size={14} className="text-[#8a8886] transition-transform group-open:rotate-90 flex-shrink-0" />

                      {/* Course info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-[#002388] uppercase tracking-wide">
                            {course.courseCode}
                          </span>
                          <span className="text-[13px] font-semibold text-[#323130] truncate">
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
                          <span className="text-[11px] text-[#8a8886]">
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
                    <div className="bg-[#faf9f8] border-t border-[#f8f9fa] divide-y divide-[#f8f9fa]">
                      {course.assessments.map((a) => {
                        const pct = a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0;
                        const typeBadge = TYPE_BADGE[a.type] ?? { bg: "#f8f9fa", text: "#605e5c" };
                        return (
                          <div key={a.id} className="flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-[#f8f9fa] transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-medium text-[#323130] truncate">{a.title}</span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase"
                                  style={{ background: typeBadge.bg, color: typeBadge.text }}
                                >
                                  {a.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#8a8886] mt-0.5">
                                {new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="hidden sm:flex items-center gap-1.5">
                                <div className="h-1.5 w-20 bg-[#edebe9] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(pct, 100)}%`, background: gradeColor(pct) }}
                                  />
                                </div>
                                <span className="text-[11px] text-[#8a8886] w-9 text-right">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <span className="text-[12px] font-bold" style={{ color: gradeColor(pct) }}>
                                {a.grade}
                              </span>
                              <Link
                                href={`/student/assessments/${a.id}/review`}
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
