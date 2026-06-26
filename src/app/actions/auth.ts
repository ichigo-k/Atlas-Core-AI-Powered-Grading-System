"use server"

import { signIn } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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

  // Determine the destination from the DB directly. We do NOT call auth() here:
  // signIn() sets the session cookie on the RESPONSE, but auth() reads the
  // REQUEST cookies in this same action — so it wouldn't see the fresh session
  // and we'd wrongly redirect back to "/" (the login page). The cookie is still
  // sent to the browser, so the subsequent navigation is authenticated.
  const email = userId.includes("@") ? userId : `${userId}@live.gctu.edu.gh`
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true, name: true, mustChangePassword: true },
  })

  if (user) {
    await logAction(
      "USER_LOGIN",
      `User ${user.name} (${user.role}) logged in`,
      "SYSTEM",
    )
  }

  // Force password change on first login
  if (user?.mustChangePassword) {
    redirect("/force-change-password")
  }

  const redirectTo = user?.role ? (ROLE_DASHBOARDS[user.role] ?? "/") : "/"
  redirect(redirectTo)
}
