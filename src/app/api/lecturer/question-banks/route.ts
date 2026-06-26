import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const banks = await prisma.questionBank.findMany({
    where: {
      OR: [
        { lecturerId },
        { isShared: true },
      ],
    },
    include: {
      course: { select: { code: true, title: true } },
      lecturer: { select: { title: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Attach per-type counts
  const bankIds = banks.map((b: any) => b.id)
  const typeCounts = await prisma.questionBankItem.groupBy({
    by: ["bankId", "type"],
    where: { bankId: { in: bankIds } },
    _count: { _all: true },
  })

  const countMap: Record<number, { OBJECTIVE: number; SUBJECTIVE: number }> = {}
  for (const row of typeCounts) {
    if (!countMap[row.bankId]) countMap[row.bankId] = { OBJECTIVE: 0, SUBJECTIVE: 0 }
    countMap[row.bankId][row.type] = row._count._all
  }

  const result = banks.map((b: any) => ({
    ...b,
    isOwn: b.lecturerId === lecturerId,
    typeCounts: countMap[b.id] ?? { OBJECTIVE: 0, SUBJECTIVE: 0 },
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { title: string; courseId?: number | null; isShared?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const bank = await prisma.questionBank.create({
    data: {
      lecturerId,
      title: body.title,
      courseId: body.courseId ?? null,
      isShared: body.isShared ?? false,
    },
  })

  return NextResponse.json(bank, { status: 201 })
}
