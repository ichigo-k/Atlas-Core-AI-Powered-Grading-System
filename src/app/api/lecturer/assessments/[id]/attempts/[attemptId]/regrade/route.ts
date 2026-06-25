import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callGraderSingle } from "@/lib/grader-client"
import { computeRetryAfterSeconds } from "@/lib/regrade-cooldown"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// POST /api/lecturer/assessments/[id]/attempts/[attemptId]/regrade
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
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

  // 5.1: Verify attempt exists and belongs to the assessment
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: { assessmentId: true },
  })
  if (!attempt || attempt.assessmentId !== assessmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // 5.1: Verify lecturer owns the assessment
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { lecturerId: true },
  })
  if (!assessment || assessment.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 5.2: Cooldown enforcement
  const cooldownMinutes = parseInt(process.env.REGRADE_COOLDOWN_MINUTES ?? "30") || 30
  const gradingResult = await prisma.gradingResult.findUnique({
    where: { attemptId },
    select: { gradedAt: true },
  })

  if (gradingResult) {
    const retryAfterSeconds = computeRetryAfterSeconds(gradingResult.gradedAt, cooldownMinutes)
    if (retryAfterSeconds !== null) {
      return NextResponse.json(
        {
          retryAfterSeconds,
          message: `Re-grading is rate limited. Please wait ${retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      )
    }
  }

  // 5.3: Call grader synchronously
  let graderResponse: Response
  try {
    graderResponse = await callGraderSingle(attemptId)
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    console.error("[regrade] Grader single call failed for attempt", attemptId, {
      isTimeout,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      {
        error: isTimeout
          ? "Grading timed out. The attempt may have many questions — please try again."
          : "Grader service is unavailable"
      },
      { status: 502 }
    )
  }

  if (!graderResponse.ok) {
    console.error("Grader returned non-2xx for attempt", attemptId, graderResponse.status)
    return NextResponse.json(
      { error: `Grader service returned an error (${graderResponse.status})` },
      { status: 502 }
    )
  }

  // Re-fetch updated score and gradedAt
  const [updatedAttempt, updatedResult] = await Promise.all([
    prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { score: true },
    }),
    prisma.gradingResult.findUnique({
      where: { attemptId },
      select: { gradedAt: true },
    }),
  ])

  return NextResponse.json({
    score: updatedAttempt?.score ?? null,
    gradedAt: updatedResult?.gradedAt ?? null,
  })
}
