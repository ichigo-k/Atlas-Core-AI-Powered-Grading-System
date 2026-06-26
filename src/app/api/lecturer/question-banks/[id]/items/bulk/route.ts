import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

interface BulkItem {
  type: string
  body: string
  marks: number
  answerType?: string | null
  options?: string[] | null
  correctOption?: number | null
  rubricCriteria?: Array<{ description: string; maxMarks: number; order: number }>
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

  let items: BulkItem[]
  try {
    const body = await request.json()
    items = body.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const created = await prisma.$transaction(async (tx) => {
    const results = []
    for (const item of items) {
      if (!item.type || !item.body?.trim() || !item.marks || item.marks < 1) continue

      const created = await tx.questionBankItem.create({
        data: {
          bankId,
          type: item.type as "OBJECTIVE" | "SUBJECTIVE",
          body: item.body,
          marks: item.marks,
          answerType: (item.answerType as "FILL_IN" | "PDF_UPLOAD" | "CODE" | null) ?? null,
          options: item.options != null ? (item.options as Prisma.InputJsonValue) : Prisma.JsonNull,
          correctOption: item.correctOption ?? null,
        },
      })

      if (item.rubricCriteria?.length) {
        await tx.questionBankItemRubric.createMany({
          data: item.rubricCriteria.map((r: any) => ({
            itemId: created.id,
            description: r.description,
            maxMarks: r.maxMarks,
            order: r.order,
          })),
        })
      }

      results.push(created)
    }
    return results
  })

  return NextResponse.json({ count: created.length }, { status: 201 })
}
