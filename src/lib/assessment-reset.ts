import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Purge every record that hangs off a set of attempts, in an order that respects
 * the foreign keys Prisma does NOT cascade for us.
 *
 * Cascade gaps this works around (see prisma/schema.prisma):
 *  - AssessmentAttempt -> Assessment  : no cascade (attempts block assessment delete)
 *  - ProctorRecord     -> Attempt     : no cascade (blocks attempt delete)
 *  - AnswerFeedback    -> GradingResult: no cascade (blocks grading-result delete)
 *  - GradingResult / AnswerFeedback   : grader-owned tables with NO Prisma FK to
 *                                       attempts, so they never cascade and would
 *                                       be orphaned unless deleted explicitly.
 *
 * What DOES cascade off AssessmentAttempt (handled automatically once the attempt
 * row is deleted): StudentAnswer, ProctorSignal, ProctorMessage.
 *
 * Must run inside a transaction — pass the transaction client as `tx`.
 */
export async function purgeAttemptData(
	tx: Prisma.TransactionClient,
	attemptIds: number[],
): Promise<void> {
	if (attemptIds.length === 0) return;

	// Grader feedback (child before parent).
	const gradingResults = await tx.gradingResult.findMany({
		where: { attemptId: { in: attemptIds } },
		select: { id: true },
	});
	const gradingResultIds = gradingResults.map((g) => g.id);
	if (gradingResultIds.length > 0) {
		await tx.answerFeedback.deleteMany({
			where: { gradingResultId: { in: gradingResultIds } },
		});
		await tx.gradingResult.deleteMany({
			where: { id: { in: gradingResultIds } },
		});
	}

	// Proctor record blocks attempt deletion (no cascade).
	await tx.proctorRecord.deleteMany({
		where: { attemptId: { in: attemptIds } },
	});

	// Deleting the attempts cascades StudentAnswer, ProctorSignal, ProctorMessage.
	await tx.assessmentAttempt.deleteMany({
		where: { id: { in: attemptIds } },
	});
}

/**
 * Reset attempts for an assessment. Deletes all attempts (or just one student's
 * when `studentId` is given) along with every dependent record, so the affected
 * students can take the assessment again from scratch.
 *
 * When the whole assessment is cleared, its grading lifecycle is also reset
 * (gradingStatus -> NOT_GRADED, resultsReleased -> false) so stale grading state
 * doesn't linger with no attempts behind it.
 *
 * Returns the number of attempts removed.
 */
export async function resetAssessmentAttempts(
	assessmentId: number,
	studentId?: number,
): Promise<number> {
	return prisma.$transaction(async (tx) => {
		const attempts = await tx.assessmentAttempt.findMany({
			where: { assessmentId, ...(studentId != null ? { studentId } : {}) },
			select: { id: true },
		});
		const attemptIds = attempts.map((a) => a.id);

		await purgeAttemptData(tx, attemptIds);

		// A full clear also wipes grading state; a single-student reset leaves the
		// rest of the cohort's grading untouched.
		if (studentId == null) {
			await tx.assessment.update({
				where: { id: assessmentId },
				data: { gradingStatus: "NOT_GRADED", resultsReleased: false },
			});
		}

		return attemptIds.length;
	});
}
