import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction } from "@/lib/audit"

async function getLecturerId(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// POST /api/lecturer/assessments/[id]/unrelease-results
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "LECTURER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const lecturerId = await getLecturerId(session.user.email!)
    if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const assessmentId = parseInt(id)
    if (isNaN(assessmentId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { lecturerId: true },
    })
    if (!assessment || assessment.lecturerId !== lecturerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { resultsReleased: false },
    })

    await logAction(
      "RESULTS_UNRELEASED",
      `Results hidden for assessment ${assessmentId} by lecturer ${lecturerId}`,
      "SYSTEM"
    )

    return NextResponse.json({ resultsReleased: false })
  } catch (err) {
    console.error("[POST /api/lecturer/assessments/[id]/unrelease-results]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
