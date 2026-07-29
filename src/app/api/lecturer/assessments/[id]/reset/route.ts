import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resetAssessmentAttempts } from "@/lib/assessment-reset";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/lecturer/assessments/[id]/reset
// Body: { studentId?: number }
//  - no studentId  -> clears every attempt/submission so the whole cohort can retake
//  - with studentId -> clears one student's attempts so they can retake even after
//                      exhausting their attempt allowance
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.email || session.user.role !== "LECTURER") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const assessmentId = Number.parseInt((await params).id, 10);
		if (Number.isNaN(assessmentId)) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		let studentId: number | undefined;
		try {
			const body = await req.json().catch(() => ({}));
			if (body && body.studentId != null) {
				const parsed = Number(body.studentId);
				if (Number.isNaN(parsed)) {
					return NextResponse.json(
						{ error: "Invalid studentId" },
						{ status: 400 },
					);
				}
				studentId = parsed;
			}
		} catch {
			// No/invalid body -> treat as a full reset.
		}

		const lecturer = await prisma.user.findUnique({
			where: { email: session.user.email },
			select: { id: true },
		});
		const assessment = await prisma.assessment.findUnique({
			where: { id: assessmentId },
			select: { lecturerId: true },
		});
		if (!lecturer || !assessment || assessment.lecturerId !== lecturer.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const removed = await resetAssessmentAttempts(assessmentId, studentId);

		await logAction(
			"ASSESSMENT_ATTEMPTS_RESET",
			studentId != null
				? `Reset ${removed} attempt(s) for student ${studentId} on assessment ${assessmentId} by lecturer ${lecturer.id}.`
				: `Reset all attempts (${removed}) on assessment ${assessmentId} by lecturer ${lecturer.id}.`,
			"SYSTEM",
		);

		return NextResponse.json({ success: true, removed });
	} catch (err) {
		console.error("[POST /api/lecturer/assessments/[id]/reset]", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
