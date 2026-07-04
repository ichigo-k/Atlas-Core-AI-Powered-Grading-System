import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const q = req.nextUrl.searchParams.get("q")?.trim()

        const lecturers = await prisma.lecturerProfile.findMany({
            where: q
                ? {
                    user: {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { email: { contains: q, mode: "insensitive" } },
                        ],
                    },
                }
                : undefined,
            include: {
                user: { select: { name: true, email: true } },
            },
            take: 20,
            orderBy: { user: { name: "asc" } },
        })

        return NextResponse.json({
            lecturers: lecturers.map((l) => ({
                id: l.id,
                label: l.user.name || "Unnamed Lecturer",
                sublabel: l.user.email,
            })),
        })
    } catch (err) {
        console.error("[GET /api/admin/lecturers/search]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
