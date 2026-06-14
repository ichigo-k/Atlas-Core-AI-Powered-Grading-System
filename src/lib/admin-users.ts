import { prisma } from "@/lib/prisma"

export type UserWithProfile = {
  id: number
  email: string
  name: string | null
  role: "STUDENT" | "LECTURER" | "ADMIN"
  status: "ACTIVE" | "SUSPENDED" | "PENDING"
  dateJoined: Date
  createdAt: Date
  studentProfile: {
    indexNumber: string | null
    program: string
    classId: number | null
  } | null
  lecturerProfile: {
    department: string
    title: string
  } | null
  adminProfile: Record<string, never> | null
}

export async function getUsersWithProfiles(): Promise<UserWithProfile[]> {
  return prisma.user.findMany({
    include: {
      studentProfile: true,
      lecturerProfile: true,
      adminProfile: true,
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<UserWithProfile[]>
}
export async function getLecturers() {
  return prisma.lecturerProfile.findMany({
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  })
}
