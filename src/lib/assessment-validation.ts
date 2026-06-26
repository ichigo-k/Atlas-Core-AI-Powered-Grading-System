// src/lib/assessment-validation.ts

export function validateWeights(sectionAWeight: number, sectionBWeight: number): string | null {
  if (sectionAWeight + sectionBWeight !== 100) {
    return "Section A and Section B weights must sum to 100"
  }
  return null
}

export function complementWeight(w: number): number {
  return 100 - w
}

export function validateLocationConstraint(isLocationBound: boolean, location: string | undefined | null): string | null {
  if (isLocationBound && !location?.trim()) {
    return "Location is required when assessment is location-bound"
  }
  return null
}

export function validatePasswordProtection(passwordProtected: boolean, accessPassword: string | undefined | null): string | null {
  if (passwordProtected && !accessPassword?.trim()) {
    return "Access password is required when password protection is enabled"
  }
  return null
}

export function validateDateRange(startsAt: string | Date, endsAt: string | Date): string | null {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (end <= start) {
    return "End date & time must be after start date & time"
  }
  return null
}

export function validateSectionAQuestion(options: string[], correctOption: number | undefined | null): string | null {
  if (options.length < 2) {
    return "Section A questions must have at least 2 options"
  }
  if (correctOption === undefined || correctOption === null) {
    return "A correct answer must be selected"
  }
  if (correctOption < 0 || correctOption >= options.length) {
    return "Correct answer index is out of range"
  }
  return null
}

export function validateSectionBQuestion(answerType: string | undefined | null): string | null {
  if (!answerType) {
    return "Answer type is required for Section B questions"
  }
  return null
}

export function validatePublishConditions(params: {
  questionCount: number
  startsAt: string | Date | null | undefined
  endsAt: string | Date | null | undefined
  classCount: number
}): string | null {
  const missing: string[] = []
  if (params.questionCount === 0) missing.push("at least one question")
  if (!params.startsAt) missing.push("start date")
  if (!params.endsAt) missing.push("end date")
  if (params.classCount === 0) missing.push("at least one assigned class")
  if (missing.length > 0) {
    return `Cannot publish: missing ${missing.join(", ")}`
  }
  return null
}

// Ownership helpers (used in API routes and property tests)
export function isCourseOwnedByLecturer(courseId: number, lecturerCourseIds: number[]): boolean {
  return lecturerCourseIds.includes(courseId)
}

export function canDeleteAssessment(assessmentLecturerId: number, requestingLecturerId: number): boolean {
  return assessmentLecturerId === requestingLecturerId
}

export function filterAssessmentsForLecturer<T extends { lecturerId: number }>(
  lecturerId: number,
  assessments: T[]
): T[] {
  return assessments.filter((a: any) => a.lecturerId === lecturerId)
}

export function validateStatusTransition(
  currentStatus: "DRAFT" | "PUBLISHED" | "CLOSED",
  targetStatus: "PUBLISHED" | "CLOSED",
  flags?: { hasQuestions: boolean; hasStartsAt: boolean; hasEndsAt: boolean; hasClasses: boolean }
): string | null {
  if (currentStatus === "CLOSED") {
    return "Cannot transition from CLOSED status"
  }
  if (currentStatus === "DRAFT" && targetStatus === "PUBLISHED") {
    if (flags) {
      const missing: string[] = []
      if (!flags.hasQuestions) missing.push("at least one question")
      if (!flags.hasStartsAt) missing.push("start date")
      if (!flags.hasEndsAt) missing.push("end date")
      if (!flags.hasClasses) missing.push("at least one assigned class")
      if (missing.length > 0) {
        return `Cannot publish: missing ${missing.join(", ")}`
      }
    }
  }
  return null
}

// Copy-on-import helper: returns a new plain object from a bank item
export function importBankItem(item: {
  section: string
  body: string
  marks: number
  answerType?: string | null
  options?: unknown
  correctOption?: number | null
  rubricCriteria?: Array<{ description: string; maxMarks: number; order: number }>
}) {
  return {
    section: item.section,
    body: item.body,
    marks: item.marks,
    answerType: item.answerType ?? null,
    options: item.options ? JSON.parse(JSON.stringify(item.options)) : null,
    correctOption: item.correctOption ?? null,
    rubricCriteria: item.rubricCriteria
      ? item.rubricCriteria.map((r: any) => ({ ...r }))
      : [],
  }
}
