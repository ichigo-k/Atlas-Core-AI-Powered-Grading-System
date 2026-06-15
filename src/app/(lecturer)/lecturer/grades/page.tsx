import { Suspense } from "react"
import { BookMarked } from "lucide-react"
import GradebookClient from "./GradebookClient"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import LoadingLogo from "@/components/ui/LoadingLogo"

export default function GradebookPage() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
          <BookMarked size={11} />
          <span>Grade Book</span>
        </div>
        <h1 className="text-xl font-semibold text-[#1e293b]">Grade Book</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          All students enrolled in your assessments. Click a student to view their results.
        </p>
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
        <GradebookClient />
      </Suspense>
    </div>
  )
}
