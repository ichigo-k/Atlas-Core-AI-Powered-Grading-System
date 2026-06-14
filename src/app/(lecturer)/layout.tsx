import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import LecturerNavbar from "@/components/layout/LecturerNavbar"
import StudentFooter from "@/components/layout/StudentFooter"

export default async function LecturerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session || session.user.role !== "LECTURER") {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <LecturerNavbar userName={session.user.name} />
      <main className="flex-1 animate-in fade-in px-4 py-6 duration-500 md:px-8">
        {children}
      </main>
      <StudentFooter />
    </div>
  )
}
