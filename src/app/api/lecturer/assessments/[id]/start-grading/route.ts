import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callGraderBatch, isGraderHealthy } from "@/lib/grader-client"
import { logAction } from "@/lib/audit"
import { submitAttemptInternal } from "@/lib/assessment-actions"

async function getLecturerId(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// POST /api/lecturer/assessments/[id]/start-grading
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

    // Verify ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { lecturerId: true, gradingStatus: true, status: true },
    })
    if (!assessment || assessment.lecturerId !== lecturerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (assessment.status !== "CLOSED") {
      return NextResponse.json(
        { error: "Assessment must be closed before grading can begin" },
        { status: 409 }
      )
    }

    // Reject only if already fully graded — allow re-triggering when stuck in GRADING
    if (assessment.gradingStatus === "GRADED") {
      return NextResponse.json({ error: "Assessment has already been graded" }, { status: 409 })
    }

    // Pre-flight: check if grader service is reachable before committing to GRADING status
    const healthy = await isGraderHealthy()
    if (!healthy) {
      return NextResponse.json(
        { error: "Grading service is currently unavailable. Please try again later." },
        { status: 503 }
      )
    }

    // Find and auto-submit all IN_PROGRESS attempts for this assessment as TIMED_OUT
    const inProgressAttempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId, status: "IN_PROGRESS" },
      select: { id: true },
    })

    if (inProgressAttempts.length > 0) {
      console.log(`[start-grading] Found ${inProgressAttempts.length} IN_PROGRESS attempts for assessment ${assessmentId}. Auto-submitting...`)
      for (const attempt of inProgressAttempts) {
        try {
          await submitAttemptInternal(attempt.id, assessmentId, "TIMED_OUT")
        } catch (submitErr) {
          console.error(`[start-grading] Failed to auto-submit attempt ${attempt.id}`, {
            attemptId: attempt.id,
            assessmentId,
            error: submitErr instanceof Error ? submitErr.message : String(submitErr),
          })
        }
      }
    }

    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { gradingStatus: "GRADING" },
    })

    await logAction(
      "GRADING_STARTED",
      `Grading started for assessment ${assessmentId} by lecturer ${lecturerId}`,
      "SYSTEM"
    )

    // Fire-and-forget: call the Django grader. On failure, reset status and log clearly.
    callGraderBatch(assessmentId)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "(unreadable)")
          console.error("[start-grading] Grader returned non-OK status", {
            assessmentId,
            status: res.status,
            body,
          })
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { gradingStatus: "NOT_GRADED" },
          })
          await logAction(
            "GRADING_FAILED",
            `Grader returned HTTP ${res.status} for assessment ${assessmentId}. Status reset to NOT_GRADED.`,
            "SYSTEM"
          )
        }
      })
      .catch(async (err) => {
        const isTimeout = err instanceof Error && err.name === "TimeoutError"
        const reason = isTimeout
          ? `Grader request timed out for assessment ${assessmentId}. The grader may still be processing — status will auto-reset if no progress is detected.`
          : `Could not reach grader service for assessment ${assessmentId}: ${err instanceof Error ? err.message : String(err)}. Status reset to NOT_GRADED.`

        console.error("[start-grading] Grader call failed", {
          assessmentId,
          isTimeout,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })

        // On timeout, don't immediately reset — the grader may still be working.
        // The status endpoint's stale detection will handle it if it truly died.
        if (!isTimeout) {
          await prisma.assessment.update({
            where: { id: assessmentId },
            data: { gradingStatus: "NOT_GRADED" },
          })
        }

        await logAction("GRADING_FAILED", reason, "SYSTEM")
      })

    return NextResponse.json({ gradingStatus: "GRADING" })
  } catch (err) {
    console.error("[POST /api/lecturer/assessments/[id]/start-grading]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
