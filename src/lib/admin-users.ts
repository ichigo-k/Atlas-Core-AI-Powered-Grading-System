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
    programId: number | null
    program: string | null
    classId: number | null
  } | null
  lecturerProfile: {
    department: string | null
    title: string
  } | null
  adminProfile: { id: number } | null
}

export async function getUsersWithProfiles(): Promise<UserWithProfile[]> {
  const users = await prisma.user.findMany({
    include: {
      studentProfile: {
        include: { program: { select: { name: true } } },
      },
      lecturerProfile: true,
      adminProfile: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return users.map((user) => ({
    ...user,
    studentProfile: user.studentProfile
      ? {
          indexNumber: user.studentProfile.indexNumber,
          programId: user.studentProfile.programId,
          program: user.studentProfile.program?.name ?? null,
          classId: user.studentProfile.classId,
        }
      : null,
  }))
}

export async function getLecturers() {
  return prisma.lecturerProfile.findMany({
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  })
}
