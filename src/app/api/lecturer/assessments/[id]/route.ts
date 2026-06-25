import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  validateLocationConstraint,
  validatePasswordProtection,
  validateDateRange,
  canDeleteAssessment,
} from "@/lib/assessment-validation"
import type { CreateAssessmentPayload } from "@/lib/assessment-types"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    include: {
      course: { select: { code: true, title: true } },
      classes: { include: { class: { select: { name: true, level: true } } } },
      sections: {
        include: {
          questions: {
            include: { rubricCriteria: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  })

  if (!assessment || assessment.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...assessment,
    courseCode: assessment.course.code,
    courseTitle: assessment.course.title,
    classes: assessment.classes.map((ac) => ({
      id: ac.id,
      classId: ac.classId,
      className: `${ac.class.name} (Level ${ac.class.level})`,
    })),
    sections: assessment.sections,
  })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const assessmentId = parseInt(id)
  if (isNaN(assessmentId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = await prisma.assessment.findUnique({ where: { id: assessmentId } })
  if (!existing || existing.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT assessments can be edited" }, { status: 400 })
  }

  let body: CreateAssessmentPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const dateErr = validateDateRange(body.startsAt, body.endsAt)
  if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 })

  const locationErr = validateLocationConstraint(body.isLocationBound, body.location)
  if (locationErr) return NextResponse.json({ error: locationErr }, { status: 400 })
  const passwordErr = validatePasswordProtection(body.passwordProtected, body.accessPassword)
  if (passwordErr) return NextResponse.json({ error: passwordErr }, { status: 400 })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          title: body.title,
          type: body.type,
          courseId: body.courseId,
          totalMarks: body.totalMarks,
          instructions: body.instructions ?? "",
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

      // Replace classes
      await tx.assessmentClass.deleteMany({ where: { assessmentId } })
      if (body.classes?.length) {
        await tx.assessmentClass.createMany({
          data: body.classes.map((c) => ({
            assessmentId,
            classId: c.classId,
          })),
        })
      }

      // Replace sections and questions
      await tx.assessmentSection.deleteMany({ where: { assessmentId } })
      if (body.sections?.length) {
        for (const s of body.sections) {
          const section = await tx.assessmentSection.create({
            data: {
              assessmentId,
              name: s.name,
              type: s.type,
              requiredQuestionsCount: s.requiredQuestionsCount ?? null,
            },
          })

          if (s.questions?.length) {
            for (const q of s.questions) {
              const question = await tx.question.create({
                data: {
                  assessmentId,
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

      return a
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("[PUT /api/lecturer/assessments/[id]]", err)
    return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const assessmentId = parseInt(id)
  if (isNaN(assessmentId)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = await prisma.assessment.findUnique({ where: { id: assessmentId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canDeleteAssessment(existing.lecturerId, lecturerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.assessment.delete({ where: { id: assessmentId } })
  return NextResponse.json({ success: true })
}
