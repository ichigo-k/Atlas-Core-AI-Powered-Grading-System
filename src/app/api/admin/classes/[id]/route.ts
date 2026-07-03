import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const classId = parseInt(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Invalid class ID" }, { status: 400 });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        name: true,
        level: true,
        _count: { select: { students: true, assessmentClasses: true } },
      },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (cls._count.students > 0) {
      return NextResponse.json(
        {
          error: `"${cls.name}" still has ${cls._count.students} student${cls._count.students === 1 ? "" : "s"} assigned. Reassign or remove them before deleting this class.`,
        },
        { status: 409 },
      );
    }
    if (cls._count.assessmentClasses > 0) {
      return NextResponse.json(
        {
          error: `"${cls.name}" is linked to ${cls._count.assessmentClasses} assessment${cls._count.assessmentClasses === 1 ? "" : "s"} and cannot be deleted.`,
        },
        { status: 409 },
      );
    }

    await prisma.class.delete({
      where: { id: classId },
    });

    await logAction(
      "CLASS_DELETED",
      `Class with ID ${classId} was deleted`,
      "CLASS"
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "This class still has related records and cannot be deleted." },
        { status: 409 },
      );
    }
    console.error("Error deleting class:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const classId = parseInt(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Invalid class ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, level, courseIds } = body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (level) updateData.level = Number(level);

    // Update courses if provided
    if (Array.isArray(courseIds)) {
      updateData.courses = {
        set: courseIds.map((id: number) => ({ id })),
      };
    }

    // Check for unique conflict if name or level is updated
    if (name || level) {
      const existingClass = await prisma.class.findFirst({
        where: {
          id: { not: classId },
          name: name || undefined,
          level: level ? Number(level) : undefined,
        },
      });

      // If we provided both, check if name_level exists.
      // But prisma might throw a unique constraint error. It's safer to just catch it.
    }

    try {
      const updatedClass = await prisma.class.update({
        where: { id: classId },
        data: updateData,
        include: {
          courses: true,
        },
      });

      await logAction(
        "CLASS_UPDATED",
        `Class "${updatedClass.name}" (Level ${updatedClass.level}) was updated`,
        "CLASS"
      );

      return NextResponse.json(updatedClass, { status: 200 });
    } catch (dbError: any) {
      if (dbError.code === "P2002") {
        return NextResponse.json({ error: "A class with this name and level already exists" }, { status: 409 });
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Error updating class:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
