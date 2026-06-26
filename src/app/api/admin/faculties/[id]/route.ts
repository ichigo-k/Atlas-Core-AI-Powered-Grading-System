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
		const item = await prisma.faculty.findUnique({ where: { id } });
		if (!item)
			return NextResponse.json({ error: "not found" }, { status: 404 });
		return NextResponse.json(item);
	} catch (err) {
		console.error("[GET /api/admin/faculties/:id]", err);
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

	const { name, code } = body as Record<string, unknown>;

	try {
		const updated = await prisma.faculty.update({
			where: { id },
			data: {
				name: typeof name === "string" ? name : undefined,
				code: typeof code === "string" ? code : undefined,
			},
		});
		await logAction(
			"FACULTY_UPDATED",
			`Faculty updated: ${updated.name}`,
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
		console.error("[PATCH /api/admin/faculties/:id]", err);
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
		await prisma.faculty.delete({ where: { id } });
		await logAction("FACULTY_DELETED", `Faculty deleted: ${id}`, "SYSTEM");
		return NextResponse.json({ ok: true });
	} catch (err) {
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === "P2003"
		) {
			return NextResponse.json(
				{
					error:
						"This faculty still has programs, courses, or lecturers linked to it. Reassign or remove those first.",
				},
				{ status: 409 },
			);
		}
		console.error("[DELETE /api/admin/faculties/:id]", err);
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
