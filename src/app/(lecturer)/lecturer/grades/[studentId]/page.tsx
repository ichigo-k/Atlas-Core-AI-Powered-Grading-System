import { Suspense } from "react"
import StudentGradeClient from "./StudentGradeClient"
import LoadingLogo from "@/components/ui/LoadingLogo"
import { TableSkeleton } from "@/components/ui/table-skeleton"
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
        <StudentGradeClient studentId={parseInt(studentId)} />
      </Suspense>
    </LecturerPageShell>
  )
}
