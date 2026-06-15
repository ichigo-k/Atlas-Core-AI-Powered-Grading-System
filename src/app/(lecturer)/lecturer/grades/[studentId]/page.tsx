import { Suspense } from "react"
import StudentGradeClient from "./StudentGradeClient"
import LoadingLogo from "@/components/ui/LoadingLogo"
import { TableSkeleton } from "@/components/ui/table-skeleton"

export default async function StudentGradePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
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
    </div>
  )
}
