import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const bankId = parseInt(id)
  if (isNaN(bankId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bank = await prisma.questionBank.findUnique({ where: { id: bankId } })
  if (!bank || bank.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const items = await prisma.questionBankItem.findMany({
    where: { bankId },
    include: { rubricCriteria: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(items)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const bankId = parseInt(id)
  if (isNaN(bankId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bank = await prisma.questionBank.findUnique({ where: { id: bankId } })
  if (!bank || bank.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: {
    type: string
    body: string
    marks: number
    answerType?: string | null
    options?: string[] | null
    correctOption?: number | null
    rubricCriteria?: Array<{ description: string; maxMarks: number; order: number }>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.type) return NextResponse.json({ error: "type is required" }, { status: 400 })
  if (!body.body?.trim()) return NextResponse.json({ error: "body is required" }, { status: 400 })
  if (!body.marks || body.marks < 1) return NextResponse.json({ error: "marks must be at least 1" }, { status: 400 })

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.questionBankItem.create({
      data: {
        bankId,
        type: body.type as "OBJECTIVE" | "SUBJECTIVE",
        body: body.body,
        marks: body.marks,
        answerType: body.answerType as "FILL_IN" | "PDF_UPLOAD" | "CODE" | null ?? null,
        options: body.options != null ? (body.options as Prisma.InputJsonValue) : Prisma.JsonNull,
        correctOption: body.correctOption ?? null,
      },
    })

    if (body.rubricCriteria?.length) {
      await tx.questionBankItemRubric.createMany({
        data: body.rubricCriteria.map((r: any) => ({
          itemId: created.id,
          description: r.description,
          maxMarks: r.maxMarks,
          order: r.order,
        })),
      })
    }

    return created
  })

  return NextResponse.json(item, { status: 201 })
}
