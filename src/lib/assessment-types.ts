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
  id?: number
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

// A group bundles a shared (optional) context with several sub-questions.
// `questions` here are the group's sub-parts; the group's totalMarks caps their sum.
export interface QuestionGroupPayload {
  id?: number
  order: number
  context?: string | null
  totalMarks: number
  questions: QuestionPayload[]
}

export interface AssessmentSectionPayload {
  id?: number
  name: string
  type: SectionTypeEnum
  requiredQuestionsCount?: number | null
  // Standalone questions (no group). Grouped questions live under `groups`.
  questions: QuestionPayload[]
  groups?: QuestionGroupPayload[]
}

export interface CreateAssessmentPayload {
  title: string
  type: AssessmentTypeEnum
  courseId: number
  instructions: string
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
    questions: Array<QuestionWithDetails>
    groups?: Array<{
      id: number
      order: number
      context: string | null
      totalMarks: number
      questions: Array<QuestionWithDetails>
    }>
  }>
}

export interface QuestionWithDetails {
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
}

// Form state types used in CreateAssessmentSheet
export interface Step1State {
  title: string
  type: AssessmentTypeEnum | ""
  courseId: number | null
  instructions: string
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

export interface GroupFormState {
  id: string // local uuid for React key
  order: number
  context: string // shared stem; may be left blank
  totalMarks: string
  questions: QuestionFormState[]
}

export interface SectionFormState {
  id: string // local uuid
  name: string
  type: SectionTypeEnum | ""
  requiredQuestionsCount: string
  pointsPerQuestion: string // Used when criteria is set
  questions: QuestionFormState[] // standalone questions
  groups: GroupFormState[]
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
