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
    const items = await prisma.program.findMany({ include: { faculty: true }, orderBy: { name: "asc" } })
    return NextResponse.json({ result: items })
  } catch (err) {
    console.error("[GET /api/admin/programs]", err)
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

  const { name, code, facultyId } = body as Record<string, unknown>
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 })
  if (!facultyId || typeof facultyId !== "number") return NextResponse.json({ error: "facultyId required" }, { status: 400 })

  try {
    const created = await prisma.program.create({ data: { name: name as string, code: typeof code === 'string' ? code : undefined, facultyId: facultyId as number } })
    await logAction("PROGRAM_CREATED", `Program created: ${created.name}`, "SYSTEM")
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[POST /api/admin/programs]", err)
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
