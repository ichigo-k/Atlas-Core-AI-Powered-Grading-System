import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import LecturerShell from "@/components/layout/LecturerShell"

export default async function LecturerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session || session.user.role !== "LECTURER") {
    redirect("/")
  }

  if (session.user.mustChangePassword) {
    redirect("/force-change-password")
  }

  return (
    <LecturerShell
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </LecturerShell>
  )
}
