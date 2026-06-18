import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notifId = Number(id);
    if (Number.isNaN(notifId)) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

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
      where: { id: notifId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/student/notifications/[id]/read]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
