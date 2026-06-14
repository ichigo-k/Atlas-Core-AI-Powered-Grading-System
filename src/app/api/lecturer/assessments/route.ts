import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  validateLocationConstraint,
  validatePasswordProtection,
  validateDateRange,
  isCourseOwnedByLecturer,
} from "@/lib/assessment-validation"
import type { CreateAssessmentPayload } from "@/lib/assessment-types"

async function getLecturerId(email: string): Promise<number | null> {
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

  // Close any PUBLISHED assessments whose end date has passed before returning the list
  const { autoCloseExpiredForLecturer } = await import('@/lib/auto-close-assessment')
  await autoCloseExpiredForLecturer(lecturerId)

  const assessments = await prisma.assessment.findMany({
    where: { lecturerId },
    include: {
      course: { select: { code: true, title: true } },
      _count: { select: { classes: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    assessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      courseCode: a.course.code,
      courseTitle: a.course.title,
      classCount: a._count.classes,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      totalMarks: a.totalMarks,
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: CreateAssessmentPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Required field checks
  if (!body.title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })
  if (!body.type) return NextResponse.json({ error: "type is required" }, { status: 400 })
  if (!body.courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 })
  if (!body.startsAt) return NextResponse.json({ error: "startsAt is required" }, { status: 400 })
  if (!body.endsAt) return NextResponse.json({ error: "endsAt is required" }, { status: 400 })
  if (!body.maxAttempts || body.maxAttempts < 1)
    return NextResponse.json({ error: "maxAttempts must be at least 1" }, { status: 400 })

  // Validate date range
  const dateErr = validateDateRange(body.startsAt, body.endsAt)
  if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 })



  // Validate location
  const locationErr = validateLocationConstraint(body.isLocationBound, body.location)
  if (locationErr) return NextResponse.json({ error: locationErr }, { status: 400 })

  // Validate password
  const passwordErr = validatePasswordProtection(body.passwordProtected, body.accessPassword)
  if (passwordErr) return NextResponse.json({ error: passwordErr }, { status: 400 })

  // Verify course ownership
  const lecturerCourses = await prisma.lecturerProfile.findUnique({
    where: { id: lecturerId },
    include: { courses: { select: { id: true } } },
  })
  const courseIds = lecturerCourses?.courses.map((c) => c.id) ?? []
  if (!isCourseOwnedByLecturer(body.courseId, courseIds)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          title: body.title,
          type: body.type,
          status: body.status ?? "DRAFT",
          courseId: body.courseId,
          lecturerId,
          totalMarks: body.totalMarks,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
          durationMinutes: body.durationMinutes ?? null,
          maxAttempts: body.maxAttempts,
          passwordProtected: body.passwordProtected,
          accessPassword: body.passwordProtected ? body.accessPassword : null,
          shuffleQuestions: body.shuffleQuestions,
          shuffleOptions: body.shuffleOptions,
          isLocationBound: body.isLocationBound,
          location: body.isLocationBound ? body.location : null,
          proctoringEnabled: body.proctoringEnabled ?? false,
        },
      })

      if (body.classes?.length) {
        await tx.assessmentClass.createMany({
          data: body.classes.map((c) => ({
            assessmentId: created.id,
            classId: c.classId,
          })),
        })
      }

      if (body.sections?.length) {
        for (const s of body.sections) {
          const section = await tx.assessmentSection.create({
            data: {
              assessmentId: created.id,
              name: s.name,
              type: s.type,
              requiredQuestionsCount: s.requiredQuestionsCount ?? null,
            },
          })

          if (s.questions?.length) {
            for (const q of s.questions) {
              const question = await tx.question.create({
                data: {
                  assessmentId: created.id,
                  sectionId: section.id,
                  order: q.order,
                  body: q.body,
                  marks: q.marks,
                  answerType: q.answerType ?? null,
                  options: q.options != null ? (q.options as Prisma.InputJsonValue) : Prisma.JsonNull,
                  correctOption: q.correctOption ?? null,
                },
              })
              if (q.rubricCriteria?.length) {
                await tx.rubricCriterion.createMany({
                  data: q.rubricCriteria.map((r) => ({
                    questionId: question.id,
                    description: r.description,
                    maxMarks: r.maxMarks,
                    order: r.order,
                  })),
                })
              }
            }
          }
        }
      }

      return created
    })

    return NextResponse.json(assessment, { status: 201 })
  } catch (err) {
    console.error("[POST /api/lecturer/assessments]", err)
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 })
  }
}
