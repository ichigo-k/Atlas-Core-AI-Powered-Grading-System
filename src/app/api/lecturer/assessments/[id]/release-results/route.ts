import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction } from "@/lib/audit"
import { sendEmailSafely } from "@/lib/email"

async function getLecturerId(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// POST /api/lecturer/assessments/[id]/release-results
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
      select: { lecturerId: true, gradingStatus: true },
    })
    if (!assessment || assessment.lecturerId !== lecturerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (assessment.gradingStatus !== "GRADED") {
      return NextResponse.json(
        { error: "Cannot release results before grading is complete" },
        { status: 409 }
      )
    }

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessmentId },
      data: { resultsReleased: true },
        select: {
          title: true,
          classes: {
            select: {
              class: {
                select: {
                students: { select: { id: true, personalEmail: true, user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    // Notify every student in the enrolled classes
    const studentIds = updatedAssessment.classes.flatMap((ac: any) =>
      ac.class.students.map((s: any) => s.id)
    );
    if (studentIds.length > 0) {
      await prisma.notification.createMany({
        data: studentIds.map((userId: any) => ({
          userId,
          type: "RESULTS_RELEASED" as const,
          title: "Results available",
          body: `Your results for "${updatedAssessment.title}" have been released.`,
          href: `/student/assessments/${assessmentId}/review`,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        })),
        skipDuplicates: false,
      });
      await Promise.all(updatedAssessment.classes.flatMap((ac: any) => ac.class.students.map((student: any) =>
        sendEmailSafely(student.personalEmail, `Results released: ${updatedAssessment.title}`, `Hello ${student.user?.name || "Student"},\n\nYour results for "${updatedAssessment.title}" have been released. Log in to the GCTU Exam Portal to view your result.\n\nGCTU Exam Portal`)
      )));
    }

    await logAction(
      "RESULTS_RELEASED",
      `Results released for assessment ${assessmentId} by lecturer ${lecturerId}`,
      "SYSTEM"
    )

    return NextResponse.json({ success: true, resultsReleased: true })
  } catch (err) {
    console.error("[POST /api/lecturer/assessments/[id]/release-results]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
