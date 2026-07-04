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

        const classes = await prisma.class.findMany({
            where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
            select: { id: true, name: true, level: true },
            take: 20,
            orderBy: { name: "asc" },
        })

        return NextResponse.json({
            classes: classes.map((c) => ({
                id: c.id,
                label: `${c.name} (L${c.level})`,
            })),
        })
    } catch (err) {
        console.error("[GET /api/admin/classes/search]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
