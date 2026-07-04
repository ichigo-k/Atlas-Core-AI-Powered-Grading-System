import { prisma } from "@/lib/prisma"

export type ClassWithDetails = {
  id: number
  name: string
  level: number
  isGraduated: boolean
  createdAt: Date
  _count: {
    students: number
    courses: number
  }
}

export type CourseWithDetails = {
  id: number
  code: string
  title: string
  credits: number
  classes: { id: number, name: string, level: number }[]
  lecturers: { id: number, user: { name: string | null } }[]
}

export async function getClasses(): Promise<ClassWithDetails[]> {
  return prisma.class.findMany({
    where: {
      isGraduated: false
    },
    include: {
      _count: {
        select: { students: true, courses: true }
      }
    },
    orderBy: [
      { level: "asc" },
      { name: "asc" }
    ]
  })
}

export async function getClassById(id: number): Promise<ClassWithDetails | null> {
  return prisma.class.findUnique({
    where: { id },
    include: {
      _count: {
        select: { students: true, courses: true }
      }
    }
  })
}

export type CourseSimple = {
  id: number
  code: string
  title: string
  credits: number
}

export async function getCourses(): Promise<CourseSimple[]> {
  return prisma.course.findMany({
    orderBy: { code: "asc" }
  })
}

export async function getCoursesWithDetails(): Promise<CourseWithDetails[]> {
  return prisma.course.findMany({
    include: {
      classes: {
        select: { id: true, name: true, level: true }
      },
      lecturers: {
        select: {
          id: true,
          user: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { code: "asc" }
  }) as unknown as Promise<CourseWithDetails[]>
}

export async function getCourseById(id: number): Promise<CourseWithDetails | null> {
  return prisma.course.findUnique({
    where: { id },
    include: {
      classes: {
        select: { id: true, name: true, level: true }
      },
      lecturers: {
        select: {
          id: true,
          user: {
            select: { name: true }
          }
        }
      }
    }
  }) as unknown as Promise<CourseWithDetails | null>
}
