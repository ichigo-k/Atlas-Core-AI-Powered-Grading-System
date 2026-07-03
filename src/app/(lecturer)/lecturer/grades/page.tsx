import { Suspense } from "react"
import { FileCheck } from "lucide-react"
import GradebookClient from "./GradebookClient"
import { LecturerTableSkeleton } from "@/components/ui/page-loaders"
import LecturerPageShell from "@/components/layout/LecturerPageShell"

export default function GradebookPage() {
  return (
    <LecturerPageShell
      title="Grade Book"
      description="All students enrolled in your assessments. Click a student to view their results."
      icon={FileCheck}
    >
      <Suspense fallback={<LecturerTableSkeleton />}>
        <GradebookClient />
      </Suspense>
    </LecturerPageShell>
  )
}
