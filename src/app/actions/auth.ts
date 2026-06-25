"use server"

import { signIn, auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { logAction } from "@/lib/audit"

const ROLE_DASHBOARDS = {
  ADMIN: "/admin",
  LECTURER: "/lecturer",
  STUDENT: "/student",
} as const

export async function loginAction(_prevState: unknown, formData: FormData) {
  const userId = formData.get("userId") as string
  const password = formData.get("password") as string
  const keepLoggedIn = formData.get("keepLoggedIn") === "true"

  try {
    await signIn("credentials", {
      userId,
      password,
      keepLoggedIn: String(keepLoggedIn),
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid ID or password." }
    }
    throw error
  }

  const session = await auth()
  const role = session?.user?.role

  if (session?.user) {
    await logAction(
      "USER_LOGIN",
      `User ${session.user.name} (${session.user.role}) logged in`,
      "SYSTEM"
    );
  }

  // Force password change on first login
  if (session?.user?.mustChangePassword) {
    redirect("/force-change-password")
  }

  const redirectTo = role ? (ROLE_DASHBOARDS[role] ?? "/") : "/"
  redirect(redirectTo)
}
