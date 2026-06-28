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
import type { AssessmentSectionPayload, CreateAssessmentPayload, QuestionPayload } from "@/lib/assessment-types"
import { assessmentTotalMarks } from "@/lib/assessment-marks"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}
class StructuralEditError extends Error {}

type AssessmentTx = Prisma.TransactionClient

function questionWriteData(q: QuestionPayload, assessmentId: number, sectionId: number, groupId?: number, groupOrder?: number) {
  return {
    assessmentId,
    sectionId,
    groupId,
    groupOrder,
    order: q.order,
    body: q.body,
    marks: q.marks,
    answerType: q.answerType ?? null,
    options: q.options != null ? (q.options as Prisma.InputJsonValue) : Prisma.JsonNull,
    correctOption: q.correctOption ?? null,
  }
}

async function createQuestionWithRubrics(
  tx: AssessmentTx,
  assessmentId: number,
  sectionId: number,
  q: QuestionPayload,
  groupId?: number,
  groupOrder?: number,
) {
  const question = await tx.question.create({
    data: questionWriteData(q, assessmentId, sectionId, groupId, groupOrder),
  })
  if (q.rubricCriteria?.length) {
    await tx.rubricCriterion.createMany({
      data: q.rubricCriteria.map((r: any) => ({
        questionId: question.id,
        description: r.description,
        maxMarks: r.maxMarks,
        order: r.order,
      })),
    })
  }
}

async function updateQuestionWithRubrics(tx: AssessmentTx, q: QuestionPayload, sectionId: number, groupId?: number, groupOrder?: number) {
  if (!q.id) throw new StructuralEditError("Existing question id is required")
  await tx.question.update({
    where: { id: q.id },
    data: {
      sectionId,
      groupId,
      groupOrder,
      order: q.order,
      body: q.body,
      marks: q.marks,
      answerType: q.answerType ?? null,
      options: q.options != null ? (q.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      correctOption: q.correctOption ?? null,
    },
  })
  await tx.rubricCriterion.deleteMany({ where: { questionId: q.id } })
  if (q.rubricCriteria?.length) {
    await tx.rubricCriterion.createMany({
      data: q.rubricCriteria.map((r: any) => ({
        questionId: q.id!,
        description: r.description,
        maxMarks: r.maxMarks,
        order: r.order,
      })),
    })
  }
}

function sameIds(actual: number[], incoming: Array<number | undefined>): boolean {
  const a = [...actual].sort((x, y) => x - y)
  const b = incoming.filter((id): id is number => typeof id === "number").sort((x, y) => x - y)
  return a.length === b.length && a.every((id, idx) => id === b[idx])
}

async function updateExistingAssessmentContent(tx: AssessmentTx, assessmentId: number, sections: AssessmentSectionPayload[]) {
  const existingSections = await tx.assessmentSection.findMany({
    where: { assessmentId },
    include: {
      questions: { where: { groupId: null }, select: { id: true } },
      groups: { include: { questions: { select: { id: true } } } },
    },
  })

  if (!sameIds(existingSections.map((s) => s.id), sections.map((s) => s.id))) {
    throw new StructuralEditError("Closed assessments with submissions cannot add or remove sections")
  }

  const sectionMap = new Map(existingSections.map((s) => [s.id, s]))
  for (const s of sections) {
    if (!s.id) throw new StructuralEditError("Existing section id is required")
    const existingSection = sectionMap.get(s.id)
    if (!existingSection) throw new StructuralEditError("Unknown section id")

    if (!sameIds(existingSection.questions.map((q) => q.id), s.questions.map((q) => q.id))) {
      throw new StructuralEditError("Closed assessments with submissions cannot add or remove standalone questions")
    }
    if (!sameIds(existingSection.groups.map((g) => g.id), (s.groups ?? []).map((g) => g.id))) {
      throw new StructuralEditError("Closed assessments with submissions cannot add or remove groups")
    }

    await tx.assessmentSection.update({
      where: { id: s.id },
      data: { name: s.name, type: s.type, requiredQuestionsCount: s.requiredQuestionsCount ?? null },
    })

    for (const q of s.questions) {
      await updateQuestionWithRubrics(tx, q, s.id)
    }

    const groupMap = new Map(existingSection.groups.map((g) => [g.id, g]))
    for (const g of s.groups ?? []) {
      if (!g.id) throw new StructuralEditError("Existing group id is required")
      const existingGroup = groupMap.get(g.id)
      if (!existingGroup) throw new StructuralEditError("Unknown group id")
      if (!sameIds(existingGroup.questions.map((q) => q.id), g.questions.map((q) => q.id))) {
        throw new StructuralEditError("Closed assessments with submissions cannot add or remove grouped questions")
      }

      await tx.questionGroup.update({
        where: { id: g.id },
        data: { order: g.order, context: g.context ?? null, totalMarks: g.totalMarks },
      })

      let groupOrder = 1
      for (const q of g.questions) {
        await updateQuestionWithRubrics(tx, q, s.id, g.id, groupOrder++)
      }
    }
  }
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
          // Standalone questions only — grouped ones are returned under `groups`.
          questions: {
            where: { groupId: null },
            include: { rubricCriteria: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
          groups: {
            include: {
              questions: {
                include: { rubricCriteria: { orderBy: { order: "asc" } } },
                orderBy: { groupOrder: "asc" },
              },
            },
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
    classes: assessment.classes.map((ac: any) => ({
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
  if (existing.status !== "DRAFT" && existing.status !== "CLOSED") {
    return NextResponse.json({ error: "Only DRAFT or CLOSED assessments can be edited" }, { status: 400 })
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

  const attemptCount = await prisma.assessmentAttempt.count({ where: { assessmentId } })
  const preserveExistingContent = existing.status === "CLOSED" && attemptCount > 0

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          title: body.title,
          type: body.type,
          courseId: body.courseId,
          totalMarks: assessmentTotalMarks(body.sections ?? []),
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
          data: body.classes.map((c: any) => ({
            assessmentId,
            classId: c.classId,
          })),
        })
      }

      if (preserveExistingContent) {
        await updateExistingAssessmentContent(tx, assessmentId, body.sections ?? [])
      } else {
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
                  data: q.rubricCriteria.map((r: any) => ({
                    questionId: question.id,
                    description: r.description,
                    maxMarks: r.maxMarks,
                    order: r.order,
                  })),
                })
              }
            }
          }

          // Grouped questions: create the group, then its sub-questions with groupId.
          if (s.groups?.length) {
            for (const g of s.groups) {
              const group = await tx.questionGroup.create({
                data: {
                  sectionId: section.id,
                  order: g.order,
                  context: g.context ?? null,
                  totalMarks: g.totalMarks,
                },
              })
              let groupOrder = 1
              for (const q of g.questions) {
                const question = await tx.question.create({
                  data: {
                    assessmentId,
                    sectionId: section.id,
                    groupId: group.id,
                    groupOrder: groupOrder++,
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
                    data: q.rubricCriteria.map((r: any) => ({
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
      }

      }

      return a
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof StructuralEditError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error("[PUT /api/lecturer/assessments/[id]] Failed to update assessment", {
      assessmentId,
      lecturerId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
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
