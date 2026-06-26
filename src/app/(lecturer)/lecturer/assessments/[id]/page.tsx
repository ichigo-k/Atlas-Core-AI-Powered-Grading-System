import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentView from "./AssessmentView"
import ProctoringTab from "./ProctoringTab"
import { Skeleton } from "@/components/ui/skeleton"
import type { AssessmentWithDetails } from "@/lib/assessment-types"
import type { AssessmentResultsData } from "./results/AssessmentResultsView"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] pb-16 space-y-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-sm" />
          <Skeleton className="h-8 w-8 rounded-sm" />
        </div>
      </div>
      <div className="rounded-sm border border-border bg-white overflow-hidden">
        <div className="h-0.5 bg-[#edebe9]" />
        <div className="px-5 py-4 flex gap-2 border-b border-[#f1f5f9]">
          <Skeleton className="h-5 w-14 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
        <div className="grid grid-cols-4 divide-x divide-[#f1f5f9]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 px-6 py-4">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 border-b border-border pb-0">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-none" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`rounded-sm border border-border bg-white p-5 space-y-3 ${i === 2 ? "md:col-span-2" : ""}`}>
            <Skeleton className="h-3 w-24" />
            {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function AssessmentData({
  id,
  initialTab,
}: {
  id: string
  initialTab: string
}) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const assessmentId = Number(id)
  if (Number.isNaN(assessmentId)) notFound()

  // ── Base assessment data ──────────────────────────────────────────────────
  const raw = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      course: { select: { code: true, title: true } },
      classes: { include: { class: { select: { name: true, level: true } } } },
      sections: {
        include: {
          questions: {
            include: { rubricCriteria: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  })

  if (!raw || raw.lecturerId !== user.id) notFound()

  const { autoCloseIfExpired } = await import("@/lib/auto-close-assessment")
  const resolvedStatus = await autoCloseIfExpired(raw)

  const assessment: AssessmentWithDetails = {
    id: raw.id,
    title: raw.title,
    type: raw.type as AssessmentWithDetails["type"],
    status: resolvedStatus as AssessmentWithDetails["status"],
    courseId: raw.courseId,
    courseCode: raw.course.code,
    courseTitle: raw.course.title,
    lecturerId: raw.lecturerId,
    totalMarks: raw.totalMarks,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    durationMinutes: raw.durationMinutes,
    maxAttempts: raw.maxAttempts,
    passwordProtected: raw.passwordProtected,
    accessPassword: raw.accessPassword,
    shuffleQuestions: raw.shuffleQuestions,
    shuffleOptions: raw.shuffleOptions,
    isLocationBound: raw.isLocationBound,
    location: raw.location,
    proctoringEnabled: raw.proctoringEnabled,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    classes: raw.classes.map((ac: { id: number; classId: number; class: { name: string } }) => ({
      id: ac.id,
      classId: ac.classId,
      className: ac.class.name,
    })),
    sections: raw.sections.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type as any,
      requiredQuestionsCount: s.requiredQuestionsCount,
      questions: s.questions.map((q: any) => ({
        id: q.id,
        order: q.order,
        body: q.body,
        marks: q.marks,
        answerType: q.answerType as any,
        options: q.options as string[] | null,
        correctOption: q.correctOption,
        rubricCriteria: q.rubricCriteria.map((rc: any) => ({
          id: rc.id,
          description: rc.description,
          maxMarks: rc.maxMarks,
          order: rc.order,
        })),
      })),
    })),
  }

  // ── Results data (only for non-DRAFT assessments) ─────────────────────────
  let resultsData: AssessmentResultsData | null = null

  if (resolvedStatus !== "DRAFT") {
    const aWithStudents = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        classes: {
          include: {
            class: {
              select: {
                name: true,
                level: true,
                students: {
                  include: { user: { select: { id: true, name: true, email: true } } },
                },
              },
            },
          },
        },
        sections: {
          select: {
            id: true,
            type: true,
            questions: { select: { id: true, marks: true } },
          },
        },
      },
    })

    if (aWithStudents) {
      const enrolledStudents: AssessmentResultsData["enrolledStudents"] = []
      const seen = new Set<number>()
      for (const ac of aWithStudents.classes) {
        for (const sp of ac.class.students) {
          if (!seen.has(sp.user.id)) {
            seen.add(sp.user.id)
            enrolledStudents.push({
              id: sp.user.id,
              name: sp.user.name ?? "Unknown",
              email: sp.user.email,
              className: ac.class.name,
            })
          }
        }
      }

      const hasSubjectiveSections = aWithStudents.sections.some((s) => s.type === "SUBJECTIVE")
      const scoreVisible = raw.gradingStatus === "GRADED" || !hasSubjectiveSections

      const attempts = await prisma.assessmentAttempt.findMany({
        where: {
          assessmentId,
          studentId: { in: enrolledStudents.map((s) => s.id) },
          status: { in: ["SUBMITTED", "TIMED_OUT"] },
        },
        orderBy: { score: "desc" },
        select: { id: true, studentId: true, score: true, submittedAt: true, status: true },
      })

      const gradingResults = await prisma.gradingResult.findMany({
        where: { assessmentId },
        select: { attemptId: true, plagiarismFlagged: true },
      })
      const plagiarismByAttemptId = new Map(gradingResults.map((gr) => [gr.attemptId, gr.plagiarismFlagged]))

      const submissionMap = new Map<number, AssessmentResultsData["submissions"][number]>()
      for (const attempt of attempts) {
        const existing = submissionMap.get(attempt.studentId)
        const isHigher =
          !existing ||
          (attempt.score !== null && (existing.score === null || attempt.score > (existing.score ?? -Infinity)))
        if (isHigher) {
          submissionMap.set(attempt.studentId, {
            studentId: attempt.studentId,
            attemptId: attempt.id,
            score: scoreVisible ? attempt.score : null,
            submittedAt: attempt.submittedAt,
            status: raw.gradingStatus === "GRADED" ? "GRADED" : "SUBMITTED",
            plagiarismFlagged: plagiarismByAttemptId.get(attempt.id) ?? false,
          })
        }
      }

      resultsData = {
        id: raw.id,
        title: raw.title,
        type: raw.type as AssessmentResultsData["type"],
        status: resolvedStatus as AssessmentResultsData["status"],
        courseCode: raw.course.code,
        courseTitle: raw.course.title,
        totalMarks: raw.totalMarks,
        totalQuestions: aWithStudents.sections.reduce((acc, s) => acc + s.questions.length, 0),
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        gradingStatus: raw.gradingStatus as "NOT_GRADED" | "GRADING" | "GRADED",
        resultsReleased: raw.resultsReleased,
        enrolledStudents,
        submissions: Array.from(submissionMap.values()),
      }
    }
  }

  const validTabs = ["overview", "results", "proctoring"]
  const tab = validTabs.includes(initialTab) ? initialTab : "overview"
  const safeTab = (resolvedStatus === "DRAFT" && tab === "results") ? "overview" : tab

  const proctoringContent = assessment.proctoringEnabled
    ? <ProctoringTab assessmentId={assessment.id} userId={user.id} />
    : null

  return (
    <AssessmentView
      assessment={assessment}
      resultsData={resultsData}
      userId={user.id}
      initialTab={safeTab as any}
      proctoringContent={proctoringContent}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = "overview" } = await searchParams
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AssessmentData id={id} initialTab={tab} />
    </Suspense>
  )
}
