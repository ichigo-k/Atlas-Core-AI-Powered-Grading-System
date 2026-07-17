import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// If grading has been stuck in GRADING for this long with no new GradingResult
// rows, consider it stale and auto-reset. Default: 20 minutes.
const STALE_GRADING_THRESHOLD_MS = parseInt(
  process.env.GRADING_STALE_THRESHOLD_MINUTES ?? "20"
) * 60 * 1000

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      select: { lecturerId: true, gradingStatus: true, resultsReleased: true, updatedAt: true },
    })

    if (!assessment || assessment.lecturerId !== lecturerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Count distinct students who submitted (not raw attempts — one student may have many)
    const submittedAttempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId, status: { in: ["SUBMITTED", "TIMED_OUT"] } },
      select: { studentId: true, id: true },
    })
    const totalAttempts = new Set(submittedAttempts.map((a) => a.studentId)).size
    const submittedAttemptIds = submittedAttempts.map((a) => a.id)

    // Count how many of those attempts have a GradingResult (one per attempt)
    const gradedAttempts = await prisma.gradingResult.count({
      where: { attemptId: { in: submittedAttemptIds } },
    })

    // Detect stale grading: if status is GRADING but no progress has been made
    // for longer than the threshold, auto-reset to NOT_GRADED so the lecturer
    // can retry without manual DB intervention.
    let gradingStatus = assessment.gradingStatus as string
    let isStale = false

    if (gradingStatus === "GRADING") {
      const timeSinceUpdate = Date.now() - assessment.updatedAt.getTime()

      if (timeSinceUpdate > STALE_GRADING_THRESHOLD_MS) {
        // Check if the grader made any recent progress (a GradingResult written recently)
        const recentResult = await prisma.gradingResult.findFirst({
          where: {
            assessmentId,
            gradedAt: { gte: new Date(Date.now() - STALE_GRADING_THRESHOLD_MS) },
          },
          select: { id: true },
        })

        if (!recentResult) {
          // No progress — auto-reset
          isStale = true
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { gradingStatus: "NOT_GRADED" },
          })
          gradingStatus = "NOT_GRADED"
          console.error("[GET /api/lecturer/assessments/[id]/status] Stale grading detected, auto-reset", {
            assessmentId,
            timeSinceUpdateMs: timeSinceUpdate,
            gradedAttempts,
            totalAttempts,
          })
        }
      }
    }

    return NextResponse.json({
      gradingStatus,
      resultsReleased: assessment.resultsReleased,
      totalAttempts,
      gradedAttempts,
      isStale,
    })
  } catch (err) {
    console.error("[GET /api/lecturer/assessments/[id]/status]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const assessmentId = parseInt(id)
  if (isNaN(assessmentId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: { status: "PUBLISHED" | "CLOSED" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.status || !["PUBLISHED", "CLOSED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be PUBLISHED or CLOSED" }, { status: 400 })
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      _count: { select: { questions: true, classes: true } },
    },
  })

  if (!assessment || assessment.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const current = assessment.status as "DRAFT" | "PUBLISHED" | "CLOSED"

  // Allowed transitions:
  //   DRAFT      → PUBLISHED  (publish)
  //   PUBLISHED  → CLOSED     (close)
  //   CLOSED     → PUBLISHED  (re-open)
  if (current === "DRAFT" && body.status !== "PUBLISHED") {
    return NextResponse.json({ error: "DRAFT can only transition to PUBLISHED" }, { status: 400 })
  }

  if (current === "DRAFT" && body.status === "PUBLISHED") {
    const missing: string[] = []
    if (assessment._count.questions === 0) missing.push("at least one question")
    if (!assessment.startsAt) missing.push("start date")
    if (!assessment.endsAt) missing.push("end date")
    if (assessment._count.classes === 0) missing.push("at least one assigned class")
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Cannot publish: missing ${missing.join(", ")}` },
        { status: 400 }
      )
    }
  }

  // CLOSED → PUBLISHED: re-open only with a future closing time.
  // PUBLISHED → CLOSED: always allowed.

  if (current === "CLOSED" && body.status === "PUBLISHED" && assessment.endsAt <= new Date()) {
    return NextResponse.json(
      { error: "Set a future closing time before re-opening this assessment." },
      { status: 409 }
    )
  }

  const updated = await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: body.status },
  })

  return NextResponse.json(updated)
}
