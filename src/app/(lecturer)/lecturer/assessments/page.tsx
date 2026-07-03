import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AssessmentsClient from "./AssessmentsClient"
import { LecturerTableSkeleton } from "@/components/ui/page-loaders"
import LecturerPageShell from "@/components/layout/LecturerPageShell"
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

  const assessmentList: AssessmentListItem[] = assessments.map((a: any) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status,
    gradingStatus: a.gradingStatus,
    resultsReleased: a.resultsReleased,
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
    <LecturerPageShell
      title="Assessments"
      description="Create and manage exams, quizzes, and assignments for your courses."
      icon={ClipboardList}
      actions={
        <Link
          href="/lecturer/assessments/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-sm text-[12px] font-semibold hover:bg-[#001570] transition-colors"
        >
          <Plus size={13} /> New Assessment
        </Link>
      }
    >
      <Suspense fallback={<LecturerTableSkeleton />}>
        <AssessmentsDataWrapper />
      </Suspense>
    </LecturerPageShell>
  )
}
