import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeGrade, parseGradingScale } from "@/lib/grading-scale"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const session = await auth()
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { studentId } = await params
        const sid = parseInt(studentId)
        if (isNaN(sid)) return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })

        // Get student info
        const student = await prisma.user.findUnique({
            where: { id: sid, role: "STUDENT" },
            select: {
                id: true,
                name: true,
                email: true,
                dateJoined: true,
                studentProfile: {
                    select: {
                        indexNumber: true,
                        legacyProgram: true,
                        program: { select: { id: true, name: true, code: true } },
                        class: { select: { id: true, name: true, level: true } },
                    },
                },
            },
        })

        if (!student || !student.studentProfile) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }

        // Fetch ALL attempts by this student — regardless of current class
        const attempts = await prisma.assessmentAttempt.findMany({
            where: {
                studentId: sid,
                status: { in: ["SUBMITTED", "TIMED_OUT"] },
            },
            orderBy: { submittedAt: "desc" },
            select: {
                id: true,
                score: true,
                status: true,
                attemptNumber: true,
                startedAt: true,
                submittedAt: true,
                assessment: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        totalMarks: true,
                        startsAt: true,
                        endsAt: true,
                        gradingStatus: true,
                        resultsReleased: true,
                        course: { select: { id: true, code: true, title: true } },
                        lecturer: {
                            select: {
                                user: { select: { name: true } },
                            },
                        },
                        classes: {
                            select: {
                                class: { select: { id: true, name: true, level: true } },
                            },
                        },
                    },
                },
            },
        })

        // Load grading scale
        const settingsRow = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
        const scale = parseGradingScale(settingsRow?.gradingScale)

        // Group by assessment — pick best attempt per assessment
        const bestByAssessment = new Map<number, typeof attempts[number]>()
        for (const attempt of attempts) {
            const existing = bestByAssessment.get(attempt.assessment.id)
            if (
                !existing ||
                (attempt.score !== null &&
                    (existing.score === null || attempt.score > (existing.score ?? -Infinity)))
            ) {
                bestByAssessment.set(attempt.assessment.id, attempt)
            }
        }

        // Build response grouped by course
        const courseMap = new Map<number, {
            courseId: number
            courseCode: string
            courseTitle: string
            assessments: {
                id: number
                title: string
                type: string
                totalMarks: number
                startsAt: Date
                endsAt: Date
                gradingStatus: string
                lecturerName: string | null
                className: string
                classLevel: number
                score: number | null
                grade: string | null
                attemptCount: number
                submittedAt: Date | null
            }[]
        }>()

        for (const [, attempt] of bestByAssessment) {
            const a = attempt.assessment
            const courseId = a.course.id

            if (!courseMap.has(courseId)) {
                courseMap.set(courseId, {
                    courseId,
                    courseCode: a.course.code,
                    courseTitle: a.course.title,
                    assessments: [],
                })
            }

            const score = attempt.score
            const grade = score !== null ? computeGrade(score, a.totalMarks, scale) : null
            const className = a.classes[0]?.class.name ?? "Unknown"
            const classLevel = a.classes[0]?.class.level ?? 0

            // Count total attempts for this assessment
            const attemptCount = attempts.filter((at: any) => at.assessment.id === a.id).length

            courseMap.get(courseId)!.assessments.push({
                id: a.id,
                title: a.title,
                type: a.type,
                totalMarks: a.totalMarks,
                startsAt: a.startsAt,
                endsAt: a.endsAt,
                gradingStatus: a.gradingStatus,
                lecturerName: a.lecturer.user.name,
                className,
                classLevel,
                score,
                grade,
                attemptCount,
                submittedAt: attempt.submittedAt,
            })
        }

        // Sort assessments within each course by date (newest first)
        for (const course of courseMap.values()) {
            course.assessments.sort((a, b) =>
                new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
            )
        }

        return NextResponse.json({
            student: {
                id: student.id,
                name: student.name ?? "Unknown",
                email: student.email,
                dateJoined: student.dateJoined,
                indexNumber: student.studentProfile.indexNumber,
                program: student.studentProfile.program?.name ?? student.studentProfile.legacyProgram ?? null,
                programCode: student.studentProfile.program?.code ?? null,
                currentClass: student.studentProfile.class?.name ?? null,
                currentLevel: student.studentProfile.class?.level ?? null,
            },
            courses: Array.from(courseMap.values()),
            summary: {
                totalAssessments: bestByAssessment.size,
                totalCourses: courseMap.size,
                averageScore: (() => {
                    const scored = Array.from(bestByAssessment.values()).filter((a: any) => a.score !== null)
                    if (scored.length === 0) return null
                    const totalPct = scored.reduce((sum, a) => {
                        return sum + ((a.score ?? 0) / a.assessment.totalMarks) * 100
                    }, 0)
                    return Math.round(totalPct / scored.length)
                })(),
            },
        })
    } catch (err) {
        console.error("[GET /api/admin/student-history/[studentId]]", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
    }
}
