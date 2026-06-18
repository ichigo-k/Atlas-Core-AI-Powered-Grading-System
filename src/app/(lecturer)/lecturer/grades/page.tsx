import { Suspense } from "react"
import { FileCheck } from "lucide-react"
import GradebookClient from "./GradebookClient"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import LoadingLogo from "@/components/ui/LoadingLogo"
import LecturerPageShell from "@/components/layout/LecturerPageShell"

export default function GradebookPage() {
  return (
    <LecturerPageShell
      title="Grade Book"
      description="All students enrolled in your assessments. Click a student to view their results."
      icon={FileCheck}
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
        <GradebookClient />
      </Suspense>
    </LecturerPageShell>
  )
}
