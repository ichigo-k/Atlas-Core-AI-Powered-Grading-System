import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Fetch all non-graduated classes
    const classes = await prisma.class.findMany({
      where: {
        isGraduated: false,
      },
    });

    // 2. Iterate and upgrade level, or mark as graduated if reached 400
    // Prisma doesn't support bulk update with computed fields easily in a single query across rows conditionally, 
    // so we'll do a transaction.
    const updates = classes.map((cls: any) => {
      if (cls.level >= 400) {
        return prisma.class.update({
          where: { id: cls.id },
          data: { isGraduated: true },
        });
      } else {
        return prisma.class.update({
          where: { id: cls.id },
          data: { level: cls.level + 100 },
        });
      }
    });

    await prisma.$transaction(updates);

    return NextResponse.json({ message: "Classes upgraded successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error upgrading classes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
