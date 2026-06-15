import { prisma } from '@/lib/prisma'
import { deriveStatus, computeAverage, sortAndLimit } from '@/lib/student-utils'
import { computeGrade, parseGradingScale } from '@/lib/grading-scale'
import type { DerivedStatus } from '@/lib/student-utils'

export type DashboardData = {
  upcomingCount: number
  ongoingCount: number
  completedCount: number
  averageScore: number | null
  upcomingAssessments: UpcomingItem[]
  recentResults: RecentResultItem[]
  gradeDistribution: Record<string, number>
}

type UpcomingItem = {
  id: number
  title: string
  type: string
  courseTitle: string
  courseCode: string
  startsAt: Date
  endsAt: Date
  durationMinutes: number | null
  location: string | null
  status: DerivedStatus
  passwordProtected: boolean
  proctoringEnabled: boolean
}

type RecentResultItem = {
  id: number
  title: string
  type: string
  courseTitle: string
  courseCode: string
  endsAt: Date
  score: number   // 0 if student never submitted
  grade: string   // computed from score on read
}

export type StudentAssessmentRow = {
  id: number
  title: string
  type: string
  status: DerivedStatus
  courseTitle: string
  courseCode: string
  courseId: number
  startsAt: Date
  endsAt: Date
  durationMinutes: number | null
  totalMarks: number
  maxAttempts: number
  resultsReleased: boolean
  gradingStatus: string
  sections: { id: number; name: string; type: string; requiredQuestionsCount: number | null }[]
  latestAttempt: { score: number | null; grade: string | null; attemptNumber: number; status: string } | null
}

export type AssessmentDetail = {
  id: number
  title: string
  type: string
  status: string
  courseId: number
  courseTitle: string
  courseCode: string
  startsAt: Date
  endsAt: Date
  durationMinutes: number | null
  totalMarks: number
  maxAttempts: number
  passwordProtected: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  isLocationBound: boolean
  location: string | null
  proctoringEnabled: boolean
  sections: {
    id: number
    name: string
    type: string
    requiredQuestionsCount: number | null
    questions: {
      id: number
      order: number
      body: string
      marks: number
      answerType: string | null
      options: unknown
    }[]
  }[]
}

export type AttemptRow = {
  id: number
  attemptNumber: number
  status: string
  score: number | null
  grade: string | null  // computed from score on read, not stored in DB
  startedAt: Date
  submittedAt: Date | null
  questionOrder: unknown
  tabSwitchLog: unknown
}

export type ActiveAttempt = {
  id: number
  assessmentId: number
  studentId: number
  attemptNumber: number
  status: string
  startedAt: Date
  submittedAt: Date | null
  questionOrder: unknown
  tabSwitchLog: unknown
  answers: {
    id: number
    questionId: number
    answerText: string | null
    selectedOption: number | null
    fileUrl: string | null
    lecturerNotes: string | null
  }[]
  proctorRecord: {
    flagCount: number
    flagThreshold: number
    sessionId: string
    signalingToken: string
  } | null
}

const EMPTY_DASHBOARD: DashboardData = {
  upcomingCount: 0,
  ongoingCount: 0,
  completedCount: 0,
  averageScore: null,
  upcomingAssessments: [],
  recentResults: [],
  gradeDistribution: {},
}

export async function getDashboardData(studentId: number): Promise<DashboardData> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { classId: true },
  })

  if (!profile?.classId) return EMPTY_DASHBOARD

  const classId = profile.classId
  const now = new Date()

  const rows = await prisma.assessmentClass.findMany({
    where: { classId },
    select: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          passwordProtected: true,
          proctoringEnabled: true,
          startsAt: true,
          endsAt: true,
          totalMarks: true,
          durationMinutes: true,
          location: true,
          course: { select: { title: true, code: true } },
          attempts: {
            where: { studentId },
            orderBy: { score: 'desc' },
            take: 1,
            select: { score: true, status: true },
          },
        },
      },
    },
  })

  const assessments = rows
    .map((r) => r.assessment)
    .filter((a) => a.status === 'PUBLISHED' || a.status === 'CLOSED')

  type Enriched = (typeof assessments)[number] & { derivedStatus: DerivedStatus }

  const enriched: Enriched[] = assessments.map((a) => ({
    ...a,
    // CLOSED assessments are always completed regardless of their date range
    derivedStatus: a.status === 'CLOSED' ? 'completed' : deriveStatus(a.startsAt, a.endsAt, now),
  }))

  const upcomingCount = enriched.filter((a) => a.derivedStatus === 'upcoming').length
  const ongoingCount = enriched.filter((a) => a.derivedStatus === 'ongoing').length
  const completedCount = enriched.filter((a) => a.derivedStatus === 'completed').length

  const averageScore = computeAverage(
    enriched
      .filter((a) => a.derivedStatus === 'completed')
      .map((a) => a.attempts[0]?.score ?? 0),  // unsubmitted = 0
  )

  const upcomingAssessments = sortAndLimit(
    enriched.filter((a) => a.derivedStatus === 'upcoming' || a.derivedStatus === 'ongoing'),
    'startsAt',
    'asc',
    3,
  ).map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    courseTitle: a.course.title,
    courseCode: a.course.code,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    durationMinutes: a.durationMinutes,
    location: a.location,
    status: a.derivedStatus,
    passwordProtected: a.passwordProtected,
    proctoringEnabled: a.proctoringEnabled,
  }))

  // Load grading scale once for grade computation
  const settingsRow = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
  const scale = parseGradingScale(settingsRow?.gradingScale)

  const recentResults = sortAndLimit(
    enriched.filter((a) => a.derivedStatus === 'completed'),
    'endsAt',
    'desc',
    4,
  ).map((a) => {
    const score = a.attempts[0]?.score ?? 0  // unsubmitted = 0
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      courseTitle: a.course.title,
      courseCode: a.course.code,
      endsAt: a.endsAt,
      score,
      grade: computeGrade(score, a.totalMarks, scale),
    }
  })

  const gradeDistribution: Record<string, number> = {}
  for (const a of enriched.filter((x) => x.derivedStatus === 'completed')) {
    const score = a.attempts[0]?.score ?? 0
    const grade = computeGrade(score, a.totalMarks, scale)
    gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1
  }

  return { upcomingCount, ongoingCount, completedCount, averageScore, upcomingAssessments, recentResults, gradeDistribution }
}

export async function getStudentAssessments(studentId: number): Promise<StudentAssessmentRow[]> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { classId: true },
  })

  if (!profile?.classId) return []

  const classId = profile.classId
  const now = new Date()

  const rows = await prisma.assessmentClass.findMany({
    where: { classId },
    select: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          courseId: true,
          startsAt: true,
          endsAt: true,
          durationMinutes: true,
          totalMarks: true,
          maxAttempts: true,
          resultsReleased: true,
          gradingStatus: true,
          course: { select: { title: true, code: true } },
          sections: {
            select: { id: true, name: true, type: true, requiredQuestionsCount: true },
          },
          attempts: {
            where: { studentId },
            orderBy: { score: 'desc' },
            take: 1,
            select: { score: true, attemptNumber: true, status: true },
          },
        },
      },
    },
  })

  // Load grading scale for grade computation
  const settingsRow2 = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
  const scale2 = parseGradingScale(settingsRow2?.gradingScale)

  return rows
    .map((r) => r.assessment)
    .filter((a) => a.status === 'PUBLISHED' || a.status === 'CLOSED')
    .map((a) => {
      const raw = a.attempts[0] ?? null
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        // CLOSED assessments are always completed regardless of their date range
        status: a.status === 'CLOSED' ? 'completed' : deriveStatus(a.startsAt, a.endsAt, now),
        courseTitle: a.course.title,
        courseCode: a.course.code,
        courseId: a.courseId,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        durationMinutes: a.durationMinutes,
        totalMarks: a.totalMarks,
        maxAttempts: a.maxAttempts,
        resultsReleased: a.resultsReleased,
        gradingStatus: a.gradingStatus,
        sections: a.sections,
        latestAttempt: raw
          ? {
            score: raw.score,
            grade: raw.score !== null ? computeGrade(raw.score, a.totalMarks, scale2) : null,
            attemptNumber: raw.attemptNumber,
            status: raw.status,
          }
          : null,
      }
    })
}

export async function getAssessmentWithQuestions(assessmentId: number, studentId?: number): Promise<AssessmentDetail | null> {
  // If a studentId is provided, verify enrollment before fetching full details.
  // This prevents students from viewing assessments for classes they are not in.
  if (studentId !== undefined) {
    const enrolled = await prisma.assessmentClass.findFirst({
      where: {
        assessmentId,
        class: { students: { some: { id: studentId } } },
      },
      select: { id: true },
    })
    if (!enrolled) return null
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      courseId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      totalMarks: true,
      maxAttempts: true,
      passwordProtected: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      isLocationBound: true,
      location: true,
      proctoringEnabled: true,
      course: { select: { title: true, code: true } },
      sections: {
        select: {
          id: true,
          name: true,
          type: true,
          requiredQuestionsCount: true,
          questions: {
            orderBy: { order: 'asc' },
            select: { id: true, order: true, body: true, marks: true, answerType: true, options: true },
          },
        },
      },
    },
  })

  if (!assessment) return null

  return {
    id: assessment.id,
    title: assessment.title,
    type: assessment.type,
    status: assessment.status,
    courseId: assessment.courseId,
    courseTitle: assessment.course.title,
    courseCode: assessment.course.code,
    startsAt: assessment.startsAt,
    endsAt: assessment.endsAt,
    durationMinutes: assessment.durationMinutes,
    totalMarks: assessment.totalMarks,
    maxAttempts: assessment.maxAttempts,
    passwordProtected: assessment.passwordProtected,
    shuffleQuestions: assessment.shuffleQuestions,
    shuffleOptions: assessment.shuffleOptions,
    isLocationBound: assessment.isLocationBound,
    location: assessment.location,
    proctoringEnabled: assessment.proctoringEnabled,
    sections: assessment.sections,
  }
}

export async function getStudentAttempts(studentId: number, assessmentId: number): Promise<AttemptRow[]> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { totalMarks: true },
  })
  const totalMarks = assessment?.totalMarks ?? 100

  const settingsRow = await prisma.systemSettings.findFirst({ select: { gradingScale: true } })
  const scale = parseGradingScale(settingsRow?.gradingScale)

  const rows = await prisma.assessmentAttempt.findMany({
    where: { studentId, assessmentId },
    orderBy: { attemptNumber: 'desc' },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
      questionOrder: true,
      tabSwitchLog: true,
    },
  })

  return rows.map((r) => ({
    ...r,
    grade: r.score !== null ? computeGrade(r.score, totalMarks, scale) : null,
  }))
}

export type ScheduleItem = {
  id: number
  title: string
  type: string
  courseTitle: string
  courseCode: string
  startsAt: Date
  endsAt: Date
  durationMinutes: number | null
  location: string | null
  status: DerivedStatus
  passwordProtected: boolean
  proctoringEnabled: boolean
}

export async function getScheduleAssessments(studentId: number): Promise<ScheduleItem[]> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { classId: true },
  })

  if (!profile?.classId) return []

  const classId = profile.classId
  const now = new Date()

  const rows = await prisma.assessmentClass.findMany({
    where: { classId },
    select: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          passwordProtected: true,
          proctoringEnabled: true,
          startsAt: true,
          endsAt: true,
          durationMinutes: true,
          location: true,
          course: { select: { title: true, code: true } },
        },
      },
    },
  })

  return rows
    .map((r) => r.assessment)
    .filter((a) => a.status === 'PUBLISHED' || a.status === 'CLOSED')
    .map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      courseTitle: a.course.title,
      courseCode: a.course.code,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      durationMinutes: a.durationMinutes,
      location: a.location,
      status: a.status === 'CLOSED' ? 'completed' : deriveStatus(a.startsAt, a.endsAt, now),
      passwordProtected: a.passwordProtected,
      proctoringEnabled: a.proctoringEnabled,
    }))
    .filter((a) => a.status === 'upcoming' || a.status === 'ongoing')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export async function getActiveAttempt(attemptId: number, studentId: number): Promise<ActiveAttempt | null> {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      assessmentId: true,
      studentId: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      questionOrder: true,
      tabSwitchLog: true,
answers: {
        select: {
          id: true,
          questionId: true,
          answerText: true,
          selectedOption: true,
          fileUrl: true,
          lecturerNotes: true,
        },
      },
      proctorRecord: {
        select: {
          flagCount: true,
          flagThreshold: true,
          sessionId: true,
          signalingToken: true,
        },
      },
    },
  })

  if (!attempt || attempt.studentId !== studentId) return null

  return attempt
}
