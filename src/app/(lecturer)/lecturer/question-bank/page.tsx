import { Suspense } from "react"
import { Library } from "lucide-react"
import QuestionBankClient from "./QuestionBankClient"
import { LecturerTableSkeleton } from "@/components/ui/page-loaders"
import LecturerPageShell from "@/components/layout/LecturerPageShell"

export default function QuestionBankPage() {
  return (
    <LecturerPageShell
      title="Question Bank"
      description="Manage reusable question banks to quickly populate new assessments."
      icon={Library}
    >
      <Suspense fallback={<LecturerTableSkeleton />}>
        <QuestionBankClient />
      </Suspense>
    </LecturerPageShell>
  )
}
