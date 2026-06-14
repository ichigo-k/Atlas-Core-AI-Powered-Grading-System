// src/lib/assessment-types.ts

export type AssessmentTypeEnum = "EXAM" | "QUIZ" | "ASSIGNMENT"
export type AssessmentStatusEnum = "DRAFT" | "PUBLISHED" | "CLOSED"
export type SectionTypeEnum = "OBJECTIVE" | "SUBJECTIVE"
export type AnswerTypeEnum = "FILL_IN" | "PDF_UPLOAD" | "CODE"

export interface RubricCriterionPayload {
  description: string
  maxMarks: number
  order: number
}

export interface QuestionPayload {
  order: number
  body: string
  marks: number
  answerType?: AnswerTypeEnum | null
  options?: string[] | null
  correctOption?: number | null
  rubricCriteria?: RubricCriterionPayload[]
}

export interface ClassAssignmentPayload {
  classId: number
}

export interface AssessmentSectionPayload {
  name: string
  type: SectionTypeEnum
  requiredQuestionsCount?: number | null
  questions: QuestionPayload[]
}

export interface CreateAssessmentPayload {
  title: string
  type: AssessmentTypeEnum
  courseId: number
  startsAt: string
  endsAt: string
  durationMinutes?: number | null
  maxAttempts: number
  passwordProtected: boolean
  accessPassword?: string | null
  shuffleQuestions: boolean
  shuffleOptions: boolean
  isLocationBound: boolean
  location?: string | null
  totalMarks: number
  status: "DRAFT" | "PUBLISHED"
  proctoringEnabled: boolean
  classes: ClassAssignmentPayload[]
  sections: AssessmentSectionPayload[]
}

export interface AssessmentListItem {
  id: number
  title: string
  type: AssessmentTypeEnum
  status: AssessmentStatusEnum
  courseCode: string
  courseTitle: string
  classCount: number
  startsAt: Date
  endsAt: Date
  totalMarks: number
}

export interface AssessmentWithDetails {
  id: number
  title: string
  type: AssessmentTypeEnum
  status: AssessmentStatusEnum
  courseId: number
  courseCode: string
  courseTitle: string
  lecturerId: number
  totalMarks: number
  startsAt: Date
  endsAt: Date
  durationMinutes: number | null
  maxAttempts: number
  passwordProtected: boolean
  accessPassword: string | null
  shuffleQuestions: boolean
  shuffleOptions: boolean
  isLocationBound: boolean
  location: string | null
  proctoringEnabled: boolean
  createdAt: Date
  updatedAt: Date
  classes: Array<{
    id: number
    classId: number
    className: string
  }>
  sections: Array<{
    id: number
    name: string
    type: SectionTypeEnum
    requiredQuestionsCount: number | null
    questions: Array<{
      id: number
      order: number
      body: string
      marks: number
      answerType: AnswerTypeEnum | null
      options: string[] | null
      correctOption: number | null
      rubricCriteria: Array<{
        id: number
        description: string
        maxMarks: number
        order: number
      }>
    }>
  }>
}

// Form state types used in CreateAssessmentSheet
export interface Step1State {
  title: string
  type: AssessmentTypeEnum | ""
  courseId: number | null
  startsAt: string
  endsAt: string
  durationMinutes: string
  maxAttempts: string
  passwordProtected: boolean
  accessPassword: string
  shuffleQuestions: boolean
  shuffleOptions: boolean
  proctoringEnabled: boolean
}

export interface ClassAssignmentState {
  classId: number
  className: string
}

export interface Step2State {
  selectedClasses: ClassAssignmentState[]
  isLocationBound: boolean
  location: string
}

export interface QuestionFormState {
  id: string // local uuid for React key
  order: number
  body: string
  marks: string
  answerType: AnswerTypeEnum | ""
  options: string[]
  correctOption: number | null
  rubricCriteria: Array<{
    id: string
    description: string
    maxMarks: string
    order: number
  }>
}

export interface SectionFormState {
  id: string // local uuid
  name: string
  type: SectionTypeEnum | ""
  requiredQuestionsCount: string
  pointsPerQuestion: string // Used when criteria is set
  questions: QuestionFormState[]
}

export interface Step3State {
  sections: SectionFormState[]
}

export interface Step4State {
  totalMarks: string
}

export interface LecturerCourse {
  id: number
  code: string
  title: string
  classes: Array<{
    id: number
    name: string
    level: number
  }>
}
