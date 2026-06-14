import { prisma } from "@/lib/prisma";

export async function logAction(
	action: string,
	details: string,
	category: "USER" | "CLASS" | "COURSE" | "FACULTY" | "PROGRAM" | "SYSTEM",
) {
	try {
		await prisma.auditLog.create({
			data: {
				action,
				details,
				category,
			},
		});
	} catch (error) {
		console.error("Failed to log action:", error);
	}
}

export async function getRecentAuditLogs(limit = 10) {
	return prisma.auditLog.findMany({
		take: limit,
		orderBy: { createdAt: "desc" },
	});
}

export async function getAuditLogs(options?: {
	category?: string;
	limit?: number;
}) {
	return prisma.auditLog.findMany({
		where: options?.category ? { category: options.category } : {},
		take: options?.limit ?? 50,
		orderBy: { createdAt: "desc" },
	});
}
