import { History } from "lucide-react"
import AdminPageShell from "@/components/layout/AdminPageShell"
import StudentHistoryLookup from "./StudentHistoryLookup"

export default function StudentHistoryPage() {
    return (
        <AdminPageShell
            title="Student history"
            description="Look up any student's complete assessment history across all courses and classes — including past enrollments."
            icon={History}
        >
            <StudentHistoryLookup />
        </AdminPageShell>
    )
}
