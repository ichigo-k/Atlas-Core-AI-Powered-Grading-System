import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// POST /api/lecturer/assessments/[id]/attempts/[attemptId]/notes
// Body: { questionId: number, lecturerNotes: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "LECTURER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const lecturerId = await getLecturerId(session.user.email!)
    if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id, attemptId: attemptIdStr } = await params
    const assessmentId = parseInt(id)
    const attemptId = parseInt(attemptIdStr)
    if (isNaN(assessmentId) || isNaN(attemptId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Parse request body
    const body = await req.json()
    const { questionId, lecturerNotes } = body
    if (typeof questionId !== "number" || typeof lecturerNotes !== "string") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // Verify lecturer owns the assessment
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { lecturerId: true },
    })
    if (!assessment || assessment.lecturerId !== lecturerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Verify attempt belongs to this assessment
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { assessmentId: true },
    })
    if (!attempt || attempt.assessmentId !== assessmentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Update lecturer notes on the student answer
    await prisma.studentAnswer.update({
      where: { attemptId_questionId: { attemptId, questionId } },
      data: { lecturerNotes },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /api/lecturer/assessments/[id]/attempts/[attemptId]/notes] Failed to save notes", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}