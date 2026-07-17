import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session || session.user.role !== "LECTURER") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const assessmentId = Number.parseInt(id, 10);
		if (Number.isNaN(assessmentId)) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const email = session.user.email;
		if (!email)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		const user = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});
		const assessment = await prisma.assessment.findUnique({
			where: { id: assessmentId },
			select: { lecturerId: true, gradingStatus: true },
		});
		if (!user || !assessment || assessment.lecturerId !== user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		if (assessment.gradingStatus !== "GRADING") {
			return NextResponse.json(
				{ error: "Grading is not currently running" },
				{ status: 409 },
			);
		}

		await prisma.assessment.update({
			where: { id: assessmentId },
			data: { gradingStatus: "NOT_GRADED" },
		});
		await logAction(
			"GRADING_CANCELLED",
			`Grading cancelled for assessment ${assessmentId} by lecturer ${user.id}`,
			"SYSTEM",
		);
		return NextResponse.json({ gradingStatus: "NOT_GRADED" });
	} catch (err) {
		console.error("[POST /api/lecturer/assessments/[id]/cancel-grading]", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
