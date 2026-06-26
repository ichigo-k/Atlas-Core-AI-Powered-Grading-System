import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft,
    ChevronRight,
    Award,
    BookOpen,
    Clock,
    Calendar,
    Layers,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    FileText,
    BarChart2,
} from "lucide-react"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { computeGrade, parseGradingScale } from "@/lib/grading-scale"
import { getAssessmentWithQuestions, getStudentAttempts } from "@/lib/student-queries"
import { getAttemptGradingDetail } from "@/lib/grading-feedback"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date) {
    return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ResultsOverviewPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const assessmentId = Number(id)
    if (Number.isNaN(assessmentId)) notFound()

    const session = await getSession()
    const email = session?.user?.email
    if (!email) redirect("/login")

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    })
    if (!user) redirect("/login")
    const studentId = user.id

    // Verify assessment exists and student has access
    const assessment = await getAssessmentWithQuestions(assessmentId, studentId)
    if (!assessment) notFound()

    // Verify results are released
    const assessmentMeta = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { resultsReleased: true, gradingStatus: true },
    })
    if (!assessmentMeta?.resultsReleased) {
        redirect(`/student/assessments/${assessmentId}`)
    }

    // Get attempts
    const attempts = await getStudentAttempts(studentId, assessmentId)
    const latestSubmitted = attempts
        .filter((a: any) => a.status === "SUBMITTED" || a.status === "TIMED_OUT")
        .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0] ?? null

    if (!latestSubmitted) {
        redirect(`/student/assessments/${assessmentId}`)
    }

    // Compute grade
    const settingsRow = await prisma.systemSettings.findFirst({
        select: { gradingScale: true },
    })
    const scale = parseGradingScale(settingsRow?.gradingScale)
    const score = latestSubmitted.score ?? 0
    const scorePct = assessment.totalMarks > 0 ? Math.round((score / assessment.totalMarks) * 100) : 0
    const grade = computeGrade(score, assessment.totalMarks, scale)

    // Get grading detail for section-level breakdown
    const gradingDetail = await getAttemptGradingDetail(latestSubmitted.id)

    // Build section performance
    const feedbackMap = new Map(
        gradingDetail?.answerFeedbacks.map((f: any) => [f.questionId, f]) ?? [],
    )

    type SectionPerformance = {
        id: number
        name: string
        type: string
        totalQuestions: number
        answeredQuestions: number
        earnedMarks: number
        possibleMarks: number
        pct: number
    }

    // Get student answers for MCQ scoring
    const attemptWithAnswers = await prisma.assessmentAttempt.findUnique({
        where: { id: latestSubmitted.id },
        select: {
            answers: {
                select: { questionId: true, selectedOption: true },
            },
        },
    })
    const answerMap = new Map(
        attemptWithAnswers?.answers.map((a: any) => [a.questionId, a]) ?? [],
    )

    // Get correct options for MCQ
    const allQuestionIds = assessment.sections.flatMap((s: any) => s.questions.map((q: any) => q.id))
    const questionsWithCorrect = await prisma.question.findMany({
        where: { id: { in: allQuestionIds } },
        select: { id: true, correctOption: true },
    })
    const correctOptionMap = new Map(questionsWithCorrect.map((q: any) => [q.id, q.correctOption]))

    const sectionPerformance: SectionPerformance[] = assessment.sections.map((section: any) => {
        let earned = 0
        let possible = 0
        let answered = 0

        for (const q of section.questions) {
            possible += q.marks

            if (section.type === "OBJECTIVE") {
                const answer = answerMap.get(q.id)
                if (answer?.selectedOption != null) {
                    answered++
                    const correct = correctOptionMap.get(q.id)
                    if (answer.selectedOption === correct) {
                        earned += q.marks
                    }
                }
            } else {
                // Subjective — use AI feedback
                const fb = feedbackMap.get(q.id)
                if (fb) {
                    answered++
                    earned += fb.totalScore
                }
            }
        }

        const pct = possible > 0 ? Math.round((earned / possible) * 100) : 0
        return {
            id: section.id,
            name: section.name,
            type: section.type,
            totalQuestions: section.questions.length,
            answeredQuestions: answered,
            earnedMarks: earned,
            possibleMarks: possible,
            pct,
        }
    })

    // Attempt metadata
    const submittedAt = latestSubmitted.submittedAt
    const attemptNumber = latestSubmitted.attemptNumber
    const wasTimedOut = latestSubmitted.status === "TIMED_OUT"

    const typeStyle = TYPE_BADGE[assessment.type] ?? { bg: "#f8f9fa", text: "#605e5c" }

    return (
        <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">
            {/* Command bar / breadcrumb */}
            <div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <BarChart2 size={11} />
                    <span>Student</span>
                    <ChevronRight size={11} />
                    <Link href="/student/grades" className="hover:text-[#002388] transition-colors">My Grades</Link>
                    <ChevronRight size={11} />
                    <span className="text-[#002388] font-medium truncate max-w-[200px]">Result Overview</span>
                </div>
                <Link
                    href="/student/grades"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#323130] hover:bg-slate-50 border border-border rounded-sm transition-colors"
                >
                    <ChevronLeft size={13} />
                    Back to Grades
                </Link>
            </div>

            <div className="px-4 py-5 md:px-6 lg:px-8 space-y-5 pb-12 max-w-[1280px]">

                {/* ── Score Hero ── */}
                <div className="bg-white border border-border rounded-sm overflow-hidden">
                    {/* Assessment identity */}
                    <div className="px-6 pt-6 pb-4 border-b border-[#f1f5f9]">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span
                                className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                style={{ background: typeStyle.bg, color: typeStyle.text }}
                            >
                                {assessment.type}
                            </span>
                            {wasTimedOut && (
                                <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
                                    Timed Out
                                </span>
                            )}
                            {gradingDetail?.plagiarismFlagged && (
                                <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                                    <ShieldAlert size={10} strokeWidth={2} />
                                    Flagged
                                </span>
                            )}
                        </div>
                        <h1 className="text-lg font-bold text-[#1e293b] leading-tight">{assessment.title}</h1>
                        <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            <BookOpen size={12} className="text-primary" strokeWidth={2} />
                            {assessment.courseTitle}
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span className="text-[#1e293b]">{assessment.courseCode}</span>
                        </p>
                    </div>

                    {/* Score display */}
                    <div className="px-6 py-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {/* Main score */}
                            <div className="flex items-center gap-5">
                                {/* Circular progress */}
                                {(() => {
                                    const r = 32, c = 2 * Math.PI * r
                                    const col = scoreColor(scorePct)
                                    return (
                                        <div className="relative h-20 w-20 flex-shrink-0">
                                            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                                                <circle cx="40" cy="40" r={r} fill="none" stroke="#eef0f3" strokeWidth="7" />
                                                <circle
                                                    cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="7"
                                                    strokeLinecap="round" strokeDasharray={c}
                                                    strokeDashoffset={c * (1 - scorePct / 100)}
                                                />
                                            </svg>
                                            <span
                                                className="absolute inset-0 flex items-center justify-center text-[17px] font-bold tabular-nums"
                                                style={{ color: col }}
                                            >
                                                {scorePct}%
                                            </span>
                                        </div>
                                    )
                                })()}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your Score</p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <span className="text-2xl font-bold text-[#1e293b]">{score}</span>
                                        <span className="text-sm font-semibold text-slate-400">/ {assessment.totalMarks}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Grade */}
                            <div className="flex flex-col justify-center items-center sm:items-start">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Grade Awarded</p>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-12 w-12 rounded-sm flex items-center justify-center text-white text-xl font-bold"
                                        style={{ background: scoreColor(scorePct) }}
                                    >
                                        {grade}
                                    </div>
                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded border ${scoreAccentClass(scorePct)}`}>
                                        {scorePct >= 50 ? "PASS" : "FAIL"}
                                    </span>
                                </div>
                            </div>

                            {/* Attempt info */}
                            <div className="flex flex-col justify-center gap-2">
                                <div className="flex items-center gap-2">
                                    <Calendar size={13} className="text-muted-foreground" strokeWidth={2} />
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</p>
                                        <p className="text-[12px] font-semibold text-[#1e293b]">
                                            {submittedAt ? formatDate(submittedAt) : "-"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileText size={13} className="text-muted-foreground" strokeWidth={2} />
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Attempt</p>
                                        <p className="text-[12px] font-semibold text-[#1e293b]">
                                            #{attemptNumber} of {assessment.maxAttempts}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Plagiarism Alert ── */}
                {gradingDetail?.plagiarismFlagged && (
                    <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 p-4">
                        <ShieldAlert size={18} className="text-red-600 shrink-0" strokeWidth={2} />
                        <div>
                            <p className="text-[12px] font-bold text-red-700 uppercase tracking-wider">Security Alert: Plagiarism Detected</p>
                            <p className="text-[11px] font-medium text-red-600/80 mt-0.5">
                                Potential similarities have been identified in your submission. Contact your lecturer for more information.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Section Performance ── */}
                <div className="bg-white border border-border rounded-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-slate-50/50">
                        <Layers size={14} className="text-[#002388]" strokeWidth={2} />
                        <span className="text-[13px] font-semibold text-[#1e293b]">Section Performance</span>
                    </div>

                    <div className="divide-y divide-[#f1f5f9]">
                        {sectionPerformance.map((section: any) => (
                            <div key={section.id} className="px-5 py-4 flex items-center gap-4">
                                {/* Section info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[12px] font-semibold text-[#1e293b] truncate">{section.name}</span>
                                        <span
                                            className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                                            style={{
                                                background: section.type === "OBJECTIVE" ? "#dcfce7" : "#f1f5f9",
                                                color: section.type === "OBJECTIVE" ? "#166534" : "#475569",
                                            }}
                                        >
                                            {section.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        {/* Score bar */}
                                        <div className="flex-1 max-w-[200px] h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${section.pct}%`,
                                                    background: scoreColor(section.pct),
                                                }}
                                            />
                                        </div>
                                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                                            {section.answeredQuestions}/{section.totalQuestions} answered
                                        </span>
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="text-right shrink-0">
                                    <p className="text-[14px] font-bold tabular-nums" style={{ color: scoreColor(section.pct) }}>
                                        {section.earnedMarks}/{section.possibleMarks}
                                    </p>
                                    <p className="text-[10px] font-semibold text-muted-foreground">{section.pct}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Quick Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Marks</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <Award size={14} className="text-primary" strokeWidth={2} />
                            <span className="text-[18px] font-bold text-[#1e293b]">{assessment.totalMarks}</span>
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Questions</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <FileText size={14} className="text-primary" strokeWidth={2} />
                            <span className="text-[18px] font-bold text-[#1e293b]">
                                {assessment.sections.reduce((s, sec) => s + sec.questions.length, 0)}
                            </span>
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sections</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <Layers size={14} className="text-primary" strokeWidth={2} />
                            <span className="text-[18px] font-bold text-[#1e293b]">{assessment.sections.length}</span>
                        </div>
                    </div>
                    <div className="bg-white border border-border rounded-sm p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <Clock size={14} className="text-primary" strokeWidth={2} />
                            <span className="text-[18px] font-bold text-[#1e293b]">
                                {assessment.durationMinutes ? `${assessment.durationMinutes}m` : "–"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/student/assessments/${assessmentId}/review`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#002388] hover:bg-[#001a66] text-white text-[12px] font-semibold transition-colors"
                    >
                        <FileText size={14} strokeWidth={2} />
                        View Full Breakdown
                        <ChevronRight size={13} />
                    </Link>
                    <Link
                        href={`/student/assessments/${assessmentId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-sm border border-border text-[12px] font-medium text-[#323130] hover:bg-slate-50 transition-colors"
                    >
                        Assessment Details
                    </Link>
                </div>
            </div>
        </div>
    )
}
