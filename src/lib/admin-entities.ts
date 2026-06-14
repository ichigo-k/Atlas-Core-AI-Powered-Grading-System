import { prisma } from "@/lib/prisma"

export type FacultySimple = {
  id: number
  name: string
  code: string | null
}

export type ProgramSimple = {
  id: number
  name: string
  code: string | null
  facultyId: number
}

export async function getFaculties(): Promise<FacultySimple[]> {
  return prisma.faculty.findMany({ orderBy: { name: "asc" } }) as Promise<FacultySimple[]>
}

export async function getPrograms(): Promise<(ProgramSimple & { faculty: FacultySimple | null })[]> {
  return prisma.program.findMany({ include: { faculty: true }, orderBy: { name: "asc" } }) as Promise<(ProgramSimple & { faculty: FacultySimple | null })[]>
}
