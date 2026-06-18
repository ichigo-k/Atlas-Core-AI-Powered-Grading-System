import { Suspense } from "react"
import { Library } from "lucide-react"
import QuestionBankClient from "./QuestionBankClient"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import LoadingLogo from "@/components/ui/LoadingLogo"
import LecturerPageShell from "@/components/layout/LecturerPageShell"

export default function QuestionBankPage() {
  return (
    <LecturerPageShell
      title="Question Bank"
      description="Manage reusable question banks to quickly populate new assessments."
      icon={Library}
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
        <QuestionBankClient />
      </Suspense>
    </LecturerPageShell>
  )
}
