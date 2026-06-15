import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentsClient from "./AssessmentsClient"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import LoadingLogo from "@/components/ui/LoadingLogo"
import type { AssessmentListItem } from "@/lib/assessment-types"

async function AssessmentsDataWrapper() {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const assessments = await prisma.assessment.findMany({
    where: { lecturerId: user.id },
    include: {
      course: { select: { code: true, title: true } },
      _count: { select: { classes: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const assessmentList: AssessmentListItem[] = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type as AssessmentListItem["type"],
    status: a.status as AssessmentListItem["status"],
    courseCode: a.course.code,
    courseTitle: a.course.title,
    classCount: a._count.classes,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    totalMarks: a.totalMarks,
  }))

  return <AssessmentsClient assessments={assessmentList} />
}

export default function LecturerAssessmentsPage() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <ClipboardList size={11} />
            <span>Assessments</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b]">Assessments</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Create and manage exams, quizzes, and assignments for your courses.
          </p>
        </div>
        <Link
          href="/lecturer/assessments/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-sm text-[12px] font-semibold hover:bg-[#001570] transition-colors"
        >
          <Plus size={13} /> New Assessment
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="relative">
            <TableSkeleton />
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <div className="scale-75 opacity-80">
                <LoadingLogo />
              </div>
            </div>
          </div>
        }
      >
        <AssessmentsDataWrapper />
      </Suspense>
    </div>
  )
}
