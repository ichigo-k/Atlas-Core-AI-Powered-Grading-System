"use server";

import type { Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		throw new Error("Forbidden");
	}
	return session;
}

function getDefaultPassword(email: string) {
	return email.includes("@") ? email.split("@")[0] : email;
}

async function deleteGradingResults(
	tx: Prisma.TransactionClient,
	where: Prisma.GradingResultWhereInput,
) {
	const gradingResults = await tx.gradingResult.findMany({
		where,
		select: { id: true },
	});
	const gradingResultIds = gradingResults.map((result) => result.id);

	if (gradingResultIds.length === 0) return;

	await tx.answerFeedback.deleteMany({
		where: { gradingResultId: { in: gradingResultIds } },
	});
	await tx.gradingResult.deleteMany({
		where: { id: { in: gradingResultIds } },
	});
}

async function deleteAttemptsWithRelatedData(
	tx: Prisma.TransactionClient,
	where: Prisma.AssessmentAttemptWhereInput,
) {
	const attempts = await tx.assessmentAttempt.findMany({
		where,
		select: { id: true },
	});
	const attemptIds = attempts.map((attempt) => attempt.id);

	if (attemptIds.length === 0) return;

	await deleteGradingResults(tx, { attemptId: { in: attemptIds } });
	await tx.proctorRecord.deleteMany({
		where: { attemptId: { in: attemptIds } },
	});
	await tx.studentAnswer.deleteMany({
		where: { attemptId: { in: attemptIds } },
	});
	await tx.assessmentAttempt.deleteMany({
		where: { id: { in: attemptIds } },
	});
}

export async function toggleUserStatusAction(
	userId: number,
	currentStatus: UserStatus,
) {
	try {
		await requireAdmin();
		const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
		await prisma.user.update({
			where: { id: userId },
			data: { status: newStatus as UserStatus },
		});

		await logAction(
			"USER_STATUS_CHANGED",
			`User ID ${userId} status changed to ${newStatus}`,
			"USER",
		);

		revalidatePath("/admin/users");
		return { success: true };
	} catch (error) {
		console.error("Failed to toggle status:", error);
		return { success: false, error: "Failed to update user status" };
	}
}

export async function deleteUserAction(userId: number) {
	try {
		const session = await requireAdmin();
		const currentUser = session.user.email
			? await prisma.user.findUnique({
					where: { email: session.user.email },
					select: { id: true },
				})
			: null;

		if (currentUser?.id === userId) {
			return { success: false, error: "You cannot delete your own account" };
		}

		const deletedUser = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({
				where: { id: userId },
				select: { id: true, email: true, name: true, role: true },
			});

			if (!user) return null;

			await deleteAttemptsWithRelatedData(tx, { studentId: userId });

			if (user.role === "LECTURER") {
				const assessments = await tx.assessment.findMany({
					where: { lecturerId: userId },
					select: { id: true },
				});
				const assessmentIds = assessments.map((assessment) => assessment.id);

				if (assessmentIds.length > 0) {
					await deleteAttemptsWithRelatedData(tx, {
						assessmentId: { in: assessmentIds },
					});
					await deleteGradingResults(tx, {
						assessmentId: { in: assessmentIds },
					});
					await tx.assessment.deleteMany({
						where: { id: { in: assessmentIds } },
					});
				}

				await tx.questionBank.deleteMany({ where: { lecturerId: userId } });
			}

			await tx.notification.deleteMany({ where: { userId } });
			await tx.studentProfile.deleteMany({ where: { id: userId } });
			await tx.lecturerProfile.deleteMany({ where: { id: userId } });
			await tx.adminProfile.deleteMany({ where: { id: userId } });
			await tx.user.delete({ where: { id: userId } });

			return user;
		});

		if (!deletedUser) {
			return { success: false, error: "User not found" };
		}

		await logAction(
			"USER_DELETED",
			`User account "${deletedUser.email}" with ID ${userId} was permanently deleted`,
			"USER",
		);

		revalidatePath("/admin/users");
		return { success: true };
	} catch (error) {
		console.error("[deleteUserAction] Failed to delete user", {
			userId,
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		return { success: false, error: "Failed to delete user" };
	}
}

export async function resetUserPasswordAction(userId: number) {
	try {
		await requireAdmin();

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		});

		if (!user) {
			return { success: false, error: "User not found" };
		}

		const temporaryPassword = getDefaultPassword(user.email);
		const passwordHash = await bcrypt.hash(temporaryPassword, 12);

		await prisma.user.update({
			where: { id: userId },
			data: {
				passwordHash,
				mustChangePassword: true,
			},
		});

		await logAction(
			"USER_PASSWORD_RESET",
			`Password was reset for user "${user.email}"`,
			"USER",
		);

		revalidatePath("/admin/users");
		return { success: true, temporaryPassword };
	} catch (error) {
		console.error("[resetUserPasswordAction] Failed to reset password", {
			userId,
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		return { success: false, error: "Failed to reset password" };
	}
}

export async function updateUserAction(userId: number, formData: FormData) {
	try {
		await requireAdmin();
		const name = formData.get("name") as string;
		const email = formData.get("email") as string;

		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { studentProfile: true, lecturerProfile: true },
		});

		if (!user) return { success: false, error: "User not found" };

		await prisma.user.update({
			where: { id: userId },
			data: {
				name,
				email,
			},
		});

		if (user.role === "STUDENT") {
			const indexNumber = formData.get("indexNumber") as string;
			const programId = Number(formData.get("programId"));
			await prisma.studentProfile.update({
				where: { id: userId },
				data: {
					indexNumber,
					programId:
						Number.isInteger(programId) && programId > 0 ? programId : null,
				},
			});
		} else if (user.role === "LECTURER") {
			const department = formData.get("department") as string;
			const title = formData.get("title") as string;
			await prisma.lecturerProfile.update({
				where: { id: userId },
				data: { department, title },
			});
		}

		await logAction(
			"USER_UPDATED",
			`Information for user "${name}" was updated`,
			"USER",
		);

		revalidatePath("/admin/users");
		return { success: true };
	} catch (error) {
		console.error("Failed to update user:", error);
		return { success: false, error: "Failed to update user" };
	}
}

export async function reassignClassAction(userId: number, classId: number) {
	try {
		await requireAdmin();
		await prisma.studentProfile.update({
			where: { id: userId },
			data: { classId },
		});

		await logAction(
			"CLASS_ASSIGNED",
			`Student ID ${userId} was assigned to class ID ${classId}`,
			"CLASS",
		);

		revalidatePath("/admin/users");
		return { success: true };
	} catch (error) {
		console.error("Failed to reassign class:", error);
		return { success: false, error: "Failed to reassign class" };
	}
}
