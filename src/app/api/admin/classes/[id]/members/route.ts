import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const members = await prisma.studentProfile.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const formattedMembers = members.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      status: m.user.status,
      program: m.legacyProgram,
    }));

    return NextResponse.json(formattedMembers, { status: 200 });
  } catch (error) {
    console.error("Error fetching class members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
