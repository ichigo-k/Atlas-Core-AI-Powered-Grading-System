import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id: rawId } = await params;
	const id = Number(rawId);
	if (Number.isNaN(id))
		return NextResponse.json({ error: "invalid id" }, { status: 400 });

	try {
		const item = await prisma.program.findUnique({
			where: { id },
			include: { faculty: true },
		});
		if (!item)
			return NextResponse.json({ error: "not found" }, { status: 404 });
		return NextResponse.json(item);
	} catch (err) {
		console.error("[GET /api/admin/programs/:id]", err);
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id: rawId } = await params;
	const id = Number(rawId);
	if (Number.isNaN(id))
		return NextResponse.json({ error: "invalid id" }, { status: 400 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { name, code, facultyId } = body as Record<string, unknown>;

	try {
		const updated = await prisma.program.update({
			where: { id },
			data: {
				name: typeof name === "string" ? name : undefined,
				code: typeof code === "string" ? code : undefined,
				facultyId: typeof facultyId === "number" ? facultyId : undefined,
			},
		});
		await logAction(
			"PROGRAM_UPDATED",
			`Program updated: ${updated.name}`,
			"SYSTEM",
		);
		return NextResponse.json(updated);
	} catch (err) {
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === "P2002"
		) {
			return NextResponse.json({ error: "duplicate" }, { status: 409 });
		}
		console.error("[PATCH /api/admin/programs/:id]", err);
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id: rawId } = await params;
	const id = Number(rawId);
	if (Number.isNaN(id))
		return NextResponse.json({ error: "invalid id" }, { status: 400 });

	try {
		await prisma.program.delete({ where: { id } });
		await logAction("PROGRAM_DELETED", `Program deleted: ${id}`, "SYSTEM");
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[DELETE /api/admin/programs/:id]", err);
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
