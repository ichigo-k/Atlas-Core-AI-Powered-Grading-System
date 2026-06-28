import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { logAction } from "@/lib/audit"
import { cookies } from "next/headers"
const SESSION_COOKIE_NAMES = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
]

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { newPassword } = await req.json()

        if (!newPassword || typeof newPassword !== "string") {
            return NextResponse.json({ error: "New password is required" }, { status: 400 })
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, mustChangePassword: true },
        })

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (!user.mustChangePassword) {
            // User already changed it (perhaps a previous request crashed halfway).
            // We should still clear their stale cookies to break them out of the loop.
            const cookieStore = await cookies()
            const allCookies = cookieStore.getAll()
            for (const cookie of allCookies) {
                if (cookie.name.includes("session-token")) {
                    cookieStore.delete(cookie.name)
                }
            }
            return NextResponse.json({ success: true, signedOut: true })
        }

        // Hash and update
        const newHash = await bcrypt.hash(newPassword, 10)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newHash,
                mustChangePassword: false,
            },
        })

        await logAction(
            "FIRST_LOGIN_PASSWORD_CHANGED",
            `User ${session.user.email} completed first-login password change`,
            "USER"
        )

        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        for (const cookie of allCookies) {
            if (cookie.name.includes("session-token")) {
                cookieStore.delete(cookie.name)
            }
        }

        return NextResponse.json({ success: true, signedOut: true })
    } catch (err) {
        console.error("[POST /api/auth/force-change-password]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
