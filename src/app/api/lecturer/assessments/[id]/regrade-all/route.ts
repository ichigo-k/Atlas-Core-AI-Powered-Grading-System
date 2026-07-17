import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { callGraderBatch, isGraderHealthy } from "@/lib/grader-client";
import { prisma } from "@/lib/prisma";

export async function POST(
	_req: NextRequest,
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

		const lecturer = await prisma.user.findUnique({
			where: { email: session.user.email },
			select: { id: true },
		});
		const assessment = await prisma.assessment.findUnique({
			where: { id: assessmentId },
			select: {
				lecturerId: true,
				status: true,
				gradingStatus: true,
				resultsReleased: true,
			},
		});

		if (!lecturer || !assessment || assessment.lecturerId !== lecturer.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		if (assessment.status !== "CLOSED" || assessment.gradingStatus !== "GRADED") {
			return NextResponse.json(
				{ error: "Only closed, fully graded assessments can be re-graded" },
				{ status: 409 },
			);
		}
		if (!(await isGraderHealthy())) {
			return NextResponse.json(
				{ error: "Grading service is currently unavailable" },
				{ status: 503 },
			);
		}

		// The grader only accepts a new batch from NOT_GRADED. Hide released
		// results while scores are being rebuilt so students never see a mixture
		// of old and newly recalculated totals.
		await prisma.assessment.update({
			where: { id: assessmentId },
			data: { gradingStatus: "NOT_GRADED", resultsReleased: false },
		});

		const graderResponse = await callGraderBatch(assessmentId);
		if (!graderResponse.ok) {
			const body = await graderResponse.text().catch(() => "(unreadable)");
			console.error("[POST regrade-all] Grader rejected batch", {
				assessmentId,
				status: graderResponse.status,
				body,
			});
			await prisma.assessment.update({
				where: { id: assessmentId },
				data: {
					gradingStatus: "GRADED",
					resultsReleased: assessment.resultsReleased,
				},
			});
			return NextResponse.json(
				{ error: "The re-grading job could not be queued" },
				{ status: 502 },
			);
		}

		await logAction(
			"GRADING_RESTARTED",
			`Full assessment re-grade queued for assessment ${assessmentId} by lecturer ${lecturer.id}.`,
			"SYSTEM",
		);
		return NextResponse.json({ gradingStatus: "GRADING", resultsReleased: false });
	} catch (err) {
		console.error("[POST /api/lecturer/assessments/[id]/regrade-all]", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
