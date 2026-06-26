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
        if (!q || q.length < 2) {
            return NextResponse.json({ students: [] })
        }

        // Search by name, email, or index number
        const students = await prisma.user.findMany({
            where: {
                role: "STUDENT",
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { studentProfile: { indexNumber: { contains: q, mode: "insensitive" } } },
                ],
            },
            take: 10,
            select: {
                id: true,
                name: true,
                email: true,
                studentProfile: {
                    select: {
                        indexNumber: true,
                        program: { select: { name: true } },
                        class: { select: { name: true, level: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
        })

        return NextResponse.json({
            students: students.map((s: any) => ({
                id: s.id,
                name: s.name ?? "Unknown",
                email: s.email,
                indexNumber: s.studentProfile?.indexNumber ?? null,
                program: s.studentProfile?.program?.name ?? null,
                className: s.studentProfile?.class?.name ?? null,
                classLevel: s.studentProfile?.class?.level ?? null,
            })),
        })
    } catch (err) {
        console.error("[GET /api/admin/student-history/search]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
