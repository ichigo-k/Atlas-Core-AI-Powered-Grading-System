import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/student/notifications/read-all]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
