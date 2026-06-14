import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { logAction } from "@/lib/audit"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const items = await prisma.course.findMany({ include: { faculty: true, program: true }, orderBy: { code: "asc" } })
    return NextResponse.json({ result: items })
  } catch (err) {
    console.error("[GET /api/admin/courses]", err)
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { code, title, credits, facultyId, programId } = body as Record<string, unknown>
  if (!code || typeof code !== "string") return NextResponse.json({ error: "code required" }, { status: 400 })
  if (!title || typeof title !== "string") return NextResponse.json({ error: "title required" }, { status: 400 })

  try {
    const created = await prisma.course.create({ data: { code: code as string, title: title as string, credits: typeof credits === 'number' ? credits : 3, facultyId: typeof facultyId === 'number' ? facultyId : undefined, programId: typeof programId === 'number' ? programId : undefined } })
    await logAction("COURSE_CREATED", `Course created: ${created.code}`, "SYSTEM")
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[POST /api/admin/courses]", err)
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
