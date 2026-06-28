import type { AssessmentSectionPayload, SectionFormState } from "./assessment-types"

type MarkQuestion = { marks: number | string | null | undefined }
type MarkGroup = { totalMarks: number | string | null | undefined }
type MarkSection = {
  requiredQuestionsCount?: number | string | null
  questions: MarkQuestion[]
  groups?: MarkGroup[] | null
}

// A "unit" is one standalone question or one whole group. Marks for a group
// unit are its declared total marks.
export function sectionUnitMarksList(sec: MarkSection): number[] {
  return [
    ...sec.questions.map((q) => Number(q.marks) || 0),
    ...(sec.groups ?? []).map((g) => Number(g.totalMarks) || 0),
  ]
}

// Marks contributed by a section. When it requires fewer units than it has
// (the "answer N of M" quota), only the highest-marked units count.
export function sectionUnitMarks(sec: MarkSection): number {
  const unitMarks = sectionUnitMarksList(sec)
  const required = Number(sec.requiredQuestionsCount)
  const list = required && required < unitMarks.length
    ? [...unitMarks].sort((a, b) => b - a).slice(0, required)
    : unitMarks
  return list.reduce((sum, m) => sum + m, 0)
}

export function assessmentTotalMarks(sections: MarkSection[]): number {
  return sections.reduce((total, sec) => total + sectionUnitMarks(sec), 0)
}

// Number of answerable units in a section (standalone questions + groups).
export function sectionUnitCount(sec: SectionFormState | AssessmentSectionPayload): number {
  return sec.questions.length + (sec.groups?.length ?? 0)
}