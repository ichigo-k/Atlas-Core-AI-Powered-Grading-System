import { Suspense } from "react"
import StudentGradeClient from "./StudentGradeClient"
import { LecturerDetailSkeleton } from "@/components/ui/page-loaders"
import LecturerPageShell from "@/components/layout/LecturerPageShell"
import { FileCheck } from "lucide-react"

export default async function StudentGradePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  return (
    <LecturerPageShell
      title="Student Results"
      icon={FileCheck}
      parentCrumbs={[{ label: "Grade Book", href: "/lecturer/grades" }]}
    >
      <Suspense fallback={<LecturerDetailSkeleton />}>
        <StudentGradeClient studentId={parseInt(studentId)} />
      </Suspense>
    </LecturerPageShell>
  )
}
