import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import bcrypt from "bcrypt"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { logAction } from "@/lib/audit"

const VALID_ROLES = ["ADMIN", "LECTURER", "STUDENT"] as const
type ValidRole = (typeof VALID_ROLES)[number]

export async function POST(request: NextRequest) {
  // 1. Auth check — Admin only
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    email,
    name,
    role,
    // Student fields
    indexNumber,
    program,
    programId,
    classId,
    // Lecturer fields
    department,
    facultyId,
    title,
  } = body as Record<string, unknown>

  // 3. Validate common required fields
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 })
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role as ValidRole)) {
    return NextResponse.json(
      { error: "role must be one of ADMIN, LECTURER, STUDENT" },
      { status: 400 }
    )
  }

  // Password defaults to the email local part (before @)
  const emailStr = email as string
  const password = emailStr.includes("@") ? emailStr.split("@")[0] : emailStr

  // 4. Validate role-specific required fields
  const validRole = role as ValidRole

  if (validRole === "STUDENT") {
    if (!indexNumber || typeof indexNumber !== "string") {
      return NextResponse.json({ error: "indexNumber is required" }, { status: 400 })
    }
    // prefer programId (new dropdown), fall back to legacy program string
    if ((programId === undefined || typeof programId !== 'number') && (!program || typeof program !== "string")) {
      return NextResponse.json({ error: "programId or program is required" }, { status: 400 })
    }
  }

  if (validRole === "LECTURER") {
    // prefer facultyId (new dropdown), fall back to department string
    if ((facultyId === undefined || typeof facultyId !== 'number') && (!department || typeof department !== "string")) {
      return NextResponse.json({ error: "facultyId or department is required" }, { status: 400 })
    }
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }
  }

  // ADMIN needs no extra fields

  // 5. Hash password (cost factor 12)
  const passwordHash = await bcrypt.hash(password as string, 12)

  // 6. Create User + role-specific profile in a single transaction (3.2)
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: email as string,
          name: name as string,
          role: validRole,
          passwordHash,
        },
      })

      if (validRole === "STUDENT") {
        await tx.studentProfile.create({
          data: {
            id: created.id,
            indexNumber: indexNumber as string,
            programId: typeof programId === 'number' ? programId : null,
            legacyProgram: typeof program === 'string' ? program : undefined,
            classId: typeof classId === "number" ? classId : null,
          },
        })
      } else if (validRole === "LECTURER") {
        await tx.lecturerProfile.create({
          data: {
            id: created.id,
            facultyId: typeof facultyId === 'number' ? facultyId : null,
            department: typeof department === 'string' ? department : undefined,
            title: title as string,
          },
        })
      } else if (validRole === "ADMIN") {
        await tx.adminProfile.create({
          data: { id: created.id },
        })
      }

      return created
    })

    // Log the action
    await logAction(
      "USER_CREATED",
      `New ${validRole.toLowerCase()} account created for ${name}`,
      "USER"
    )

    // 7. Return 201
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      { status: 201 }
    )
  } catch (err) {
    // 8. Handle unique constraint violations (3.3)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined) ?? []
      if (fields.includes("email")) {
        return NextResponse.json({ error: "email already exists" }, { status: 409 })
      }
      // Fallback for any other unique constraint
      return NextResponse.json({ error: "A unique constraint was violated" }, { status: 409 })
    }

    console.error("[POST /api/admin/users]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
