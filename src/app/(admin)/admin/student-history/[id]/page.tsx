import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    BookOpen,
    Calendar,
    Award,
    User,
    Mail,
    Hash,
    Layers,
    History,
    TrendingUp,
    BarChart2,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeGrade, parseGradingScale } from "@/lib/grading-scale"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(pct: number): string {
    if (pct >= 70) return "#107c10"
    if (pct >= 50) return "#ca5010"
    if (pct >= 30) return "#d83b01"
    return "#a4262c"
}

function scoreAccentClass(pct: number): string {
    if (pct >= 70) return "bg-green-50 text-green-700 border-green-200"
    if (pct >= 50) return "bg-amber-50 text-amber-700 border-amber-200"
    return "bg-red-50 text-red-700 border-red-200"
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
    EXAM: { bg: "#fde7e9", text: "#a4262c" },
    QUIZ: { bg: "#fff4ce", text: "#7a4f00" },
    ASSIGNMENT: { bg: "#dff6dd", text: "#107c10" },
}

function formatDate(date: Date) {
    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StudentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") redirect("/")

    const { id } = await params
    const studentId = parseInt(id)
    if (isNaN(studentId)) notFound()

    // Fetch student info
    const student = await prisma.user.findUnique({
        where: { id: studentId, role: "STUDENT" },
        select: {
            id: true,
            name: true,
            email: true,
            dateJoined: true,
            status: true,
            studentProfile: {
                select: {
                    indexNumber: true,
                    legacyProgram: true,
                    program: { select: { name: true, code: true } },
                    class: { select: { name: true, level: true } },
                },
            },
        },
    })

    if (!student || !student.studentProfile) notFound()

    // Fetch all submitted attempts
    const attempts = await prisma.assessmentAttempt.findMany({
        where: {
            studentId,
            status: { in: ["SUBMITTED", "TIMED_OUT"] },
        },
        orderBy: { submittedAt: "desc" },
        select: {
            id: true,
            score: true,
            status: true,
            attemptNumber: true,
            submittedAt: true,
            assessment: {
                select: {
                    id: true,
                    title: true,
                    type: true,
                    totalMarks: true,
                    startsAt: true,
                    gradingStatus: true,
                    resultsReleased: true,
                    course: { select: { id: true, code: true, title: true } },
                    lecturer: { select: { user: { select: { name: true } } } },
                    classes: { select: { class: { select: { name: true, level: true } } } },
                },
            },
        },
    })

    // Grading scale
    const settingsRow = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
    const scale = parseGradingScale(settingsRow?.gradingScale)

    // Best attempt per assessment
    const bestByAssessment = new Map<number, typeof attempts[number]>()
    for (const attempt of attempts) {
        const existing = bestByAssessment.get(attempt.assessment.id)
        if (!existing || (attempt.score !== null && (existing.score === null || attempt.score > (existing.score ?? -Infinity)))) {
            bestByAssessment.set(attempt.assessment.id, attempt)
        }
    }

    // Group by course
    type CourseGroup = {
        courseId: number
        courseCode: string
        courseTitle: string
        avgPct: number
        avgGrade: string
        assessments: {
            id: number
            title: string
            type: string
            totalMarks: number
            score: number | null
            grade: string | null
            pct: number
            submittedAt: Date | null
            gradingStatus: string
            lecturerName: string | null
            className: string
            attemptCount: number
        }[]
    }

    const courseMap = new Map<number, CourseGroup>()
    for (const [, attempt] of bestByAssessment) {
        const a = attempt.assessment
        const courseId = a.course.id
        if (!courseMap.has(courseId)) {
            courseMap.set(courseId, {
                courseId,
                courseCode: a.course.code,
                courseTitle: a.course.title,
                avgPct: 0,
                avgGrade: "",
                assessments: [],
            })
        }

        const score = attempt.score
        const grade = score !== null ? computeGrade(score, a.totalMarks, scale) : null
        const pct = a.totalMarks > 0 && score !== null ? Math.round((score / a.totalMarks) * 100) : 0
        const attemptCount = attempts.filter((at: typeof attempts[number]) => at.assessment.id === a.id).length

        courseMap.get(courseId)!.assessments.push({
            id: a.id,
            title: a.title,
            type: a.type,
            totalMarks: a.totalMarks,
            score,
            grade,
            pct,
            submittedAt: attempt.submittedAt,
            gradingStatus: a.gradingStatus,
            lecturerName: a.lecturer.user.name,
            className: a.classes[0]?.class.name ?? "–",
            attemptCount,
        })
    }

    // Compute course averages
    const courses: CourseGroup[] = []
    for (const course of courseMap.values()) {
        const scored = course.assessments.filter((a) => a.score !== null)
        if (scored.length > 0) {
            course.avgPct = Math.round(scored.reduce((sum, a) => sum + a.pct, 0) / scored.length)
            course.avgGrade = computeGrade(course.avgPct, 100, scale)
        }
        course.assessments.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
        courses.push(course)
    }
    courses.sort((a, b) => b.avgPct - a.avgPct)

    // Summary stats
    const totalAssessments = bestByAssessment.size
    const totalCourses = courses.length
    const scoredAttempts = Array.from(bestByAssessment.values()).filter((a) => a.score !== null)
    const overallAvgPct = scoredAttempts.length > 0
        ? Math.round(scoredAttempts.reduce((sum, a) => sum + ((a.score ?? 0) / a.assessment.totalMarks) * 100, 0) / scoredAttempts.length)
        : null
    const overallGrade = overallAvgPct !== null ? computeGrade(overallAvgPct, 100, scale) : null

    const profile = student.studentProfile

    return (
        <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">
            {/* Breadcrumb bar */}
            <div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <History size={11} />
                    <Link href="/admin" className="hover:text-[#1e293b] transition-colors">Admin</Link>
                    <ChevronRight size={11} />
                    <Link href="/admin/student-history" className="hover:text-[#1e293b] transition-colors">Student History</Link>
                    <ChevronRight size={11} />
                    <span className="text-[#002388] font-medium truncate max-w-[200px]">
                        {student.name ?? student.email}
                    </span>
                </div>
                <Link
                    href="/admin/student-history"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#323130] hover:bg-slate-50 border border-border rounded-sm transition-colors"
                >
                    <ChevronLeft size={13} />
                    Back
                </Link>
            </div>

            <div className="px-4 py-5 md:px-6 lg:px-8 space-y-5 pb-12 max-w-[1280px]">

                {/* ── Student Identity Card ── */}
                <div className="bg-white border border-border rounded-sm overflow-hidden">
                    <div className="px-6 py-5 flex flex-col sm:flex-row items-start gap-5">
                        {/* Avatar */}
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dbeafe] text-[#002388] shrink-0">
                            <GraduationCap size={26} />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h1 className="text-lg font-bold text-[#1e293b]">{student.name ?? "–"}</h1>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${student.status === "ACTIVE"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : student.status === "SUSPENDED"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-slate-50 text-slate-600 border-border"
                                    }`}>
                                    {student.status}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-[12px]">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail size={12} />
                                    <span className="truncate text-[#1e293b]">{student.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Hash size={12} />
                                    <span className="text-[#1e293b]">{profile.indexNumber ?? "–"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <GraduationCap size={12} />
                                    <span className="text-[#1e293b] truncate">{profile.program?.name ?? profile.legacyProgram ?? "–"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Layers size={12} />
                                    <span className="text-[#1e293b]">
                                        {profile.class ? `${profile.class.name} (Level ${profile.class.level})` : "–"}
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Joined {student.dateJoined ? formatDate(student.dateJoined) : "–"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Summary Metrics ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Average</p>
                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-[22px] font-bold" style={{ color: overallAvgPct !== null ? scoreColor(overallAvgPct) : "#94a3b8" }}>
                                {overallAvgPct !== null ? `${overallAvgPct}%` : "–"}
                            </span>
                            {overallGrade && (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${scoreAccentClass(overallAvgPct ?? 0)}`}>
                                    {overallGrade}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assessments</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <BarChart2 size={14} className="text-[#002388]" />
                            <span className="text-[22px] font-bold text-[#1e293b]">{totalAssessments}</span>
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Courses</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <BookOpen size={14} className="text-[#002388]" />
                            <span className="text-[22px] font-bold text-[#1e293b]">{totalCourses}</span>
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Best Course</p>
                        {courses[0] ? (
                            <div className="mt-2">
                                <p className="text-[12px] font-semibold text-[#1e293b] truncate">{courses[0].courseCode}</p>
                                <span className="text-[11px] font-bold" style={{ color: scoreColor(courses[0].avgPct) }}>
                                    {courses[0].avgPct}% ({courses[0].avgGrade})
                                </span>
                            </div>
                        ) : (
                            <p className="text-[14px] text-muted-foreground mt-2">–</p>
                        )}
                    </div>
                </div>

                {/* ── Course Breakdown ── */}
                {courses.length === 0 ? (
                    <div className="bg-white border border-border rounded-sm py-16 flex flex-col items-center gap-3 text-center">
                        <BookOpen size={32} className="text-[#c8c6c4]" />
                        <p className="text-[13px] font-semibold text-[#1e293b]">No assessment records</p>
                        <p className="text-[12px] text-muted-foreground max-w-sm">
                            This student has not completed any assessments yet.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <BookOpen size={14} className="text-[#002388]" />
                            <h2 className="text-[13px] font-semibold text-[#1e293b]">Course Performance</h2>
                            <div className="flex-1 h-px bg-border ml-2" />
                        </div>

                        {courses.map((course) => (
                            <details key={course.courseId} className="group bg-white border border-border rounded-sm overflow-hidden">
                                <summary className="flex items-center gap-3 px-5 py-3.5 cursor-pointer list-none hover:bg-[#f8f9fa] transition-colors">
                                    <ChevronRight size={14} className="text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-bold text-[#002388] uppercase tracking-wide">{course.courseCode}</span>
                                            <span className="text-[13px] font-semibold text-[#1e293b] truncate">{course.courseTitle}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="h-1.5 w-28 bg-[#f1f5f9] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${Math.min(course.avgPct, 100)}%`, background: scoreColor(course.avgPct) }}
                                                />
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">
                                                {course.assessments.length} assessment{course.assessments.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[13px] font-bold" style={{ color: scoreColor(course.avgPct) }}>
                                            {course.avgPct}%
                                        </span>
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${scoreAccentClass(course.avgPct)}`}>
                                            {course.avgGrade}
                                        </span>
                                    </div>
                                </summary>

                                {/* Assessment rows */}
                                <div className="border-t border-border divide-y divide-[#f1f5f9] bg-[#fafaf9]">
                                    {course.assessments.map((a) => {
                                        const typeBadge = TYPE_BADGE[a.type] ?? { bg: "#f8f9fa", text: "#605e5c" }
                                        return (
                                            <div key={a.id} className="flex items-center gap-3 px-5 py-3 pl-11 hover:bg-white/60 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[12px] font-medium text-[#1e293b] truncate">{a.title}</span>
                                                        <span
                                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase"
                                                            style={{ background: typeBadge.bg, color: typeBadge.text }}
                                                        >
                                                            {a.type}
                                                        </span>
                                                        {a.attemptCount > 1 && (
                                                            <span className="text-[9px] font-semibold text-muted-foreground bg-slate-100 border border-border px-1.5 py-0.5 rounded-sm">
                                                                {a.attemptCount} attempts
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                                                        {a.submittedAt && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar size={10} />
                                                                {formatDate(a.submittedAt)}
                                                            </span>
                                                        )}
                                                        <span>Class: {a.className}</span>
                                                        {a.lecturerName && <span>By: {a.lecturerName}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {a.score !== null ? (
                                                        <>
                                                            <div className="text-right">
                                                                <p className="text-[12px] font-bold tabular-nums" style={{ color: scoreColor(a.pct) }}>
                                                                    {a.score}/{a.totalMarks}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground">{a.pct}%</p>
                                                            </div>
                                                            {a.grade && (
                                                                <span className={`text-[11px] font-bold h-7 w-7 flex items-center justify-center rounded-sm border ${scoreAccentClass(a.pct)}`}>
                                                                    {a.grade}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground italic">
                                                            {a.gradingStatus === "GRADING" ? "Grading…" : "Not graded"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
