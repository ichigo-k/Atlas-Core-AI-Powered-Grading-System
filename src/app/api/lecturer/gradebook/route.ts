import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getLecturerId(email: string) {
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

  // All assessments by this lecturer with enrolled classes + students
  const assessments = await prisma.assessment.findMany({
    where: { lecturerId, status: { not: "DRAFT" } },
    select: {
      id: true,
      totalMarks: true,
      course: { select: { id: true, code: true, title: true } },
      classes: {
        select: {
          class: {
            select: {
              id: true,
              name: true,
              level: true,
              students: {
                select: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // Collect all student IDs and assessment IDs
  const allStudentIds = new Set<number>()
  const allAssessmentIds = assessments.map((a: any) => a.id)

  for (const a of assessments) {
    for (const ac of a.classes) {
      for (const sp of ac.class.students) {
        allStudentIds.add(sp.user.id)
      }
    }
  }

  // Fetch best attempt per student per assessment (highest score, SUBMITTED/TIMED_OUT)
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      assessmentId: { in: allAssessmentIds },
      studentId: { in: Array.from(allStudentIds) },
      status: { in: ["SUBMITTED", "TIMED_OUT"] },
    },
    select: { assessmentId: true, studentId: true, score: true },
    orderBy: { score: "desc" },
  })

  // Best score per (studentId, assessmentId)
  const bestScore = new Map<string, number | null>()
  for (const a of attempts) {
    const key = `${a.studentId}:${a.assessmentId}`
    if (!bestScore.has(key)) bestScore.set(key, a.score)
  }

  // Build student map
  const studentMap = new Map<number, {
    id: number
    name: string
    email: string
    classId: number
    className: string
    classLevel: number
    assessmentIds: Set<number>
    courseIds: Set<number>
    totalEarned: number
    totalPossible: number
  }>()

  for (const assessment of assessments) {
    for (const ac of assessment.classes) {
      for (const sp of ac.class.students) {
        const sid = sp.user.id
        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            id: sid,
            name: sp.user.name ?? "Unknown",
            email: sp.user.email,
            classId: ac.class.id,
            className: ac.class.name,
            classLevel: ac.class.level,
            assessmentIds: new Set(),
            courseIds: new Set(),
            totalEarned: 0,
            totalPossible: 0,
          })
        }
        const entry = studentMap.get(sid)!
        if (!entry.assessmentIds.has(assessment.id)) {
          entry.assessmentIds.add(assessment.id)
          entry.courseIds.add(assessment.course.id)
          // Add to totals — unsubmitted counts as 0
          const score = bestScore.get(`${sid}:${assessment.id}`) ?? 0
          entry.totalEarned += score
          entry.totalPossible += assessment.totalMarks
        }
      }
    }
  }

  // Collect unique courses and classes for filter options
  const coursesMap = new Map<number, { id: number; code: string; title: string }>()
  const classesMap = new Map<number, { id: number; name: string; level: number }>()

  for (const assessment of assessments) {
    coursesMap.set(assessment.course.id, assessment.course)
    for (const ac of assessment.classes) {
      classesMap.set(ac.class.id, {
        id: ac.class.id,
        name: ac.class.name,
        level: ac.class.level,
      })
    }
  }

  const students = Array.from(studentMap.values()).map((s: any) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    classId: s.classId,
    className: s.className,
    classLevel: s.classLevel,
    assessmentCount: s.assessmentIds.size,
    courseIds: Array.from(s.courseIds),
    totalEarned: s.totalEarned,
    totalPossible: s.totalPossible,
    overallPct: s.totalPossible > 0
      ? Math.round((s.totalEarned / s.totalPossible) * 100)
      : null,
  }))

  // Unique levels for filter
  const levels = Array.from(new Set(students.map((s: any) => s.classLevel))).sort((a, b) => a - b)

  return NextResponse.json({
    students,
    courses: Array.from(coursesMap.values()),
    classes: Array.from(classesMap.values()),
    levels,
  })
}
