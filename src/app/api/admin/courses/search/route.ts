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

        const courses = await prisma.course.findMany({
            where: q
                ? {
                    OR: [
                        { code: { contains: q, mode: "insensitive" } },
                        { title: { contains: q, mode: "insensitive" } },
                    ],
                }
                : undefined,
            select: { id: true, code: true, title: true },
            take: 20,
            orderBy: { code: "asc" },
        })

        return NextResponse.json({
            results: courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` })),
        })
    } catch (err) {
        console.error("[GET /api/admin/courses/search]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
