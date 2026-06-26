import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentForm from "../AssessmentForm"
import { Skeleton } from "@/components/ui/skeleton"
import type { LecturerCourse } from "@/lib/assessment-types"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] pb-16 space-y-8 animate-pulse">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      {/* stepper */}
      <div className="rounded-sm border border-border bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-14" />
              {i < 3 && <Skeleton className="h-px flex-1" />}
            </div>
          ))}
        </div>
      </div>
      {/* form card */}
      <div className="rounded-sm border border-border bg-white p-5 space-y-4">
        <Skeleton className="h-3 w-36" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-sm border border-border bg-white p-5 space-y-4">
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function NewAssessmentData() {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const profile = await prisma.lecturerProfile.findUnique({
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
  })

  const lecturerCourses: LecturerCourse[] = (profile?.courses ?? []).map((c: any) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    classes: c.classes,
  }))

  return <AssessmentForm lecturerCourses={lecturerCourses} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewAssessmentData />
    </Suspense>
  )
}
