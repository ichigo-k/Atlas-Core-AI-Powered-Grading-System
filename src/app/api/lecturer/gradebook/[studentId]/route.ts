import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeGrade, parseGradingScale } from "@/lib/grading-scale"

async function getLecturerId(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { studentId } = await params
  const sid = parseInt(studentId)
  if (isNaN(sid)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Get student info
  const student = await prisma.user.findUnique({
    where: { id: sid },
    select: {
      id: true,
      name: true,
      email: true,
      studentProfile: {
        select: {
          program: true,
          class: { select: { id: true, name: true, level: true } },
        },
      },
    },
  })
  if (!student || !student.studentProfile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const classId = student.studentProfile.class?.id
  if (!classId) {
    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name ?? "Unknown",
        email: student.email,
        program: student.studentProfile.program,
        className: null,
        classLevel: null,
      },
      assessments: [],
    })
  }

  // Get all assessments by this lecturer that include this student's class
  const assessments = await prisma.assessment.findMany({
    where: {
      lecturerId,
      classes: { some: { classId } },
      status: { not: "DRAFT" },
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      totalMarks: true,
      startsAt: true,
      endsAt: true,
      course: { select: { code: true, title: true } },
    },
    orderBy: { startsAt: "desc" },
  })

  if (assessments.length === 0) {
    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name ?? "Unknown",
        email: student.email,
        program: student.studentProfile.program,
        className: student.studentProfile.class?.name ?? null,
        classLevel: student.studentProfile.class?.level ?? null,
      },
      assessments: [],
    })
  }

  // Fetch all submitted/timed-out attempts per assessment for this student — pick highest score
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      studentId: sid,
      assessmentId: { in: assessments.map((a: any) => a.id) },
      status: { in: ["SUBMITTED", "TIMED_OUT"] },
    },
    orderBy: { score: "desc" },
    select: {
      assessmentId: true,
      score: true,
      status: true,
      submittedAt: true,
    },
  })

  // Highest score per assessment (nulls last)
  const attemptMap = new Map<number, typeof attempts[number]>()
  for (const attempt of attempts) {
    const existing = attemptMap.get(attempt.assessmentId)
    const isHigher =
      !existing ||
      (attempt.score !== null &&
        (existing.score === null || attempt.score > (existing.score ?? -Infinity)))
    if (isHigher) {
      attemptMap.set(attempt.assessmentId, attempt)
    }
  }

  // Load grading scale once for grade computation
  const settingsRow = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
  const scale = parseGradingScale(settingsRow?.gradingScale)

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name ?? "Unknown",
      email: student.email,
      program: student.studentProfile.program,
      className: student.studentProfile.class?.name ?? null,
      classLevel: student.studentProfile.class?.level ?? null,
    },
    assessments: assessments.map((a: any) => {
      const attempt = attemptMap.get(a.id)
      const score = attempt?.score ?? null
      const grade = score !== null ? computeGrade(score, a.totalMarks, scale) : null
      const submissionStatus: "NOT_SUBMITTED" | "SUBMITTED" | "GRADED" =
        attempt ? (grade ? "GRADED" : "SUBMITTED") : "NOT_SUBMITTED"
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        totalMarks: a.totalMarks,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        courseCode: a.course.code,
        courseTitle: a.course.title,
        score,
        grade,
        submissionStatus,
      }
    }),
  })
}
