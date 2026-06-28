import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { logAction } from "@/lib/audit"
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
            return NextResponse.json({ error: "Password change not required" }, { status: 400 })
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

        const response = NextResponse.json({ success: true, signedOut: true })
        for (const cookieName of SESSION_COOKIE_NAMES) {
            response.cookies.set(cookieName, "", {
                path: "/",
                maxAge: 0,
                expires: new Date(0),
            })
        }

        return response
    } catch (err) {
        console.error("[POST /api/auth/force-change-password]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
