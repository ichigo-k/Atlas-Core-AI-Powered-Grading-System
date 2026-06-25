import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentForm from "../../AssessmentForm"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  LecturerCourse,
  Step1State,
  Step2State,
  Step3State,
  Step4State,
  AnswerTypeEnum,
} from "@/lib/assessment-types"

// ─── Skeleton (reuse same shape as new page) ──────────────────────────────────

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl w-full pb-16 space-y-10 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <Skeleton className="h-4 w-14" />
            {i < 3 && <Skeleton className="h-px flex-1" />}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <Skeleton className="h-3 w-36" />
        <div className="grid grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function EditAssessmentData({ id }: { id: string }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const assessmentId = Number(id)
  if (Number.isNaN(assessmentId)) notFound()

  const [raw, profile] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
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
    }),
    prisma.lecturerProfile.findUnique({
      where: { id: user.id },
      include: {
        courses: {
          select: {
            id: true,
            code: true,
            title: true,
            classes: { select: { id: true, name: true, level: true } },
          },
        },
      },
    }),
  ])

  if (!raw || raw.lecturerId !== user.id) notFound()
  if (raw.status !== "DRAFT") redirect(`/lecturer/assessments/${assessmentId}`)

  const lecturerCourses: LecturerCourse[] = (profile?.courses ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    classes: c.classes,
  }))

  const initialStep1: Step1State = {
    title: raw.title,
    type: raw.type as Step1State["type"],
    courseId: raw.courseId,
    instructions: raw.instructions ?? "",
    startsAt: toDatetimeLocal(raw.startsAt),
    endsAt: toDatetimeLocal(raw.endsAt),
    durationMinutes: raw.durationMinutes != null ? String(raw.durationMinutes) : "",
    maxAttempts: String(raw.maxAttempts),
    passwordProtected: raw.passwordProtected,
    accessPassword: raw.accessPassword ?? "",
    shuffleQuestions: raw.shuffleQuestions,
    shuffleOptions: raw.shuffleOptions,
    proctoringEnabled: raw.proctoringEnabled,
  }

  const initialStep2: Step2State = {
    selectedClasses: raw.classes.map((ac) => ({
      classId: ac.classId,
      className: `${ac.class.name} (Level ${ac.class.level})`,
    })),
    isLocationBound: raw.isLocationBound,
    location: raw.location ?? "",
  }

  const initialStep3: Step3State = {
    sections: (raw as any).sections.map((s: any) => ({
      id: crypto.randomUUID(),
      name: s.name,
      type: s.type,
      requiredQuestionsCount: s.requiredQuestionsCount ? String(s.requiredQuestionsCount) : "",
      pointsPerQuestion: s.questions[0] ? String(s.questions[0].marks) : "",
      questions: s.questions.map((q: any) => ({
        id: crypto.randomUUID(),
        order: q.order,
        body: q.body,
        marks: String(q.marks),
        answerType: (q.answerType as AnswerTypeEnum | "") ?? "",
        options: Array.isArray(q.options) ? (q.options as string[]) : ["", ""],
        correctOption: q.correctOption,
        rubricCriteria: q.rubricCriteria.map((r: any) => ({
          id: crypto.randomUUID(),
          description: r.description,
          maxMarks: String(r.maxMarks),
          order: r.order,
        })),
      })),
    })),
  }

  const initialStep4: Step4State = { totalMarks: String(raw.totalMarks) }

  return (
    <AssessmentForm
      lecturerCourses={lecturerCourses}
      assessmentId={assessmentId}
      initialStep1={initialStep1}
      initialStep2={initialStep2}
      initialStep3={initialStep3}
      initialStep4={initialStep4}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditAssessmentData id={id} />
    </Suspense>
  )
}
