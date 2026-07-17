import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { submitAttemptInternal } from "@/lib/assessment-actions";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { callGraderBatch, isGraderHealthy } from "@/lib/grader-client";
import { prisma } from "@/lib/prisma";

async function getLecturerId(email: string) {
	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true },
	});
	return user?.id ?? null;
}

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session || session.user.role !== "LECTURER") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const email = session.user.email;
		if (!email)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		const lecturerId = await getLecturerId(email);
		if (!lecturerId)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });

		const { id } = await params;
		const assessmentId = Number.parseInt(id, 10);
		if (Number.isNaN(assessmentId)) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const assessment = await prisma.assessment.findUnique({
			where: { id: assessmentId },
			select: { lecturerId: true, gradingStatus: true, status: true },
		});
		if (!assessment || assessment.lecturerId !== lecturerId) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		if (assessment.status !== "CLOSED") {
			return NextResponse.json(
				{ error: "Assessment must be closed before grading can begin" },
				{ status: 409 },
			);
		}
		if (assessment.gradingStatus === "GRADED") {
			return NextResponse.json(
				{ error: "Assessment has already been graded" },
				{ status: 409 },
			);
		}
		if (assessment.gradingStatus === "GRADING") {
			return NextResponse.json(
				{
					error:
						"Grading is already in progress. Cancel it before trying again.",
				},
				{ status: 409 },
			);
		}

		if (!(await isGraderHealthy())) {
			return NextResponse.json(
				{
					error:
						"Grading service is currently unavailable. Please try again later.",
				},
				{ status: 503 },
			);
		}

		const inProgressAttempts = await prisma.assessmentAttempt.findMany({
			where: { assessmentId, status: "IN_PROGRESS" },
			select: { id: true },
		});
		for (const attempt of inProgressAttempts) {
			try {
				await submitAttemptInternal(attempt.id, assessmentId, "TIMED_OUT");
			} catch (submitErr) {
				console.error("[start-grading] Failed to auto-submit attempt", {
					attemptId: attempt.id,
					assessmentId,
					error:
						submitErr instanceof Error ? submitErr.message : String(submitErr),
				});
			}
		}

		// The grader owns the NOT_GRADED -> GRADING transition after it queues the
		// job. Setting GRADING here first made the grader skip queueing entirely.
		const graderResponse = await callGraderBatch(assessmentId);
		if (!graderResponse.ok) {
			const body = await graderResponse.text().catch(() => "(unreadable)");
			console.error("[start-grading] Grader returned non-OK status", {
				assessmentId,
				status: graderResponse.status,
				body,
			});
			await prisma.assessment.update({
				where: { id: assessmentId },
				data: { gradingStatus: "NOT_GRADED" },
			});
			await logAction(
				"GRADING_FAILED",
				`Grader returned HTTP ${graderResponse.status} for assessment ${assessmentId}.`,
				"SYSTEM",
			);
			return NextResponse.json(
				{ error: "The grading job could not be queued. Please try again." },
				{ status: 502 },
			);
		}

		await logAction(
			"GRADING_STARTED",
			`Grading queued for assessment ${assessmentId} by lecturer ${lecturerId}`,
			"SYSTEM",
		);
		return NextResponse.json({ gradingStatus: "GRADING" });
	} catch (err) {
		console.error("[POST /api/lecturer/assessments/[id]/start-grading]", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
