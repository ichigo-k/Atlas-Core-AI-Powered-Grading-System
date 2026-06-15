import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentDetailView from "./AssessmentDetailView"
import { Skeleton } from "@/components/ui/skeleton"
import type { AssessmentWithDetails } from "@/lib/assessment-types"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-16 space-y-6 animate-pulse">
      {/* nav */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-16 rounded-sm" />
      </div>
      {/* hero */}
      <div className="rounded-sm border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-56" />
        <div className="border-t border-slate-100 mt-4 pt-4 grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      {/* info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`rounded-sm border border-slate-200 bg-white p-5 space-y-3 ${i === 2 ? "md:col-span-2" : ""}`}>
            <Skeleton className="h-3 w-24" />
            {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
          </div>
        ))}
      </div>
      {/* table */}
      <div className="rounded-sm border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <Skeleton className="h-3 w-20" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function AssessmentDetailData({ id }: { id: string }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const assessmentId = Number(id)
  if (Number.isNaN(assessmentId)) notFound()

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

  // Auto-close if the end date has passed but status is still PUBLISHED
  const { autoCloseIfExpired } = await import('@/lib/auto-close-assessment')
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
    classes: raw.classes.map((ac) => ({
      id: ac.id,
      classId: ac.classId,
      className: ac.class.name,
    })),
    sections: raw.sections.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type as any,
      requiredQuestionsCount: s.requiredQuestionsCount,
      questions: s.questions.map((q) => ({
        id: q.id,
        order: q.order,
        body: q.body,
        marks: q.marks,
        answerType: q.answerType as any,
        options: q.options as string[] | null,
        correctOption: q.correctOption,
        rubricCriteria: q.rubricCriteria.map((rc) => ({
          id: rc.id,
          description: rc.description,
          maxMarks: rc.maxMarks,
          order: rc.order,
        })),
      })),
    })),
  }

  return <AssessmentDetailView assessment={assessment} userId={user.id} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AssessmentDetailData id={id} />
    </Suspense>
  )
}
