import { prisma } from "@/lib/prisma";
import { getRecentAuditLogs } from "@/lib/audit";

export async function getAdminDashboardStats() {
	const [
		studentCount,
		lecturerCount,
		classCount,
		courseCount,
		suspendedCount,
		classesWithoutCoursesCount,
		coursesWithoutLecturersCount,
		classesWithoutStudentsCount,
		lecturersWithoutCoursesCount,
		studentsWithoutClassesCount,
		coursesWithoutClassesCount,
		auditLogs,
	] = await Promise.all([
		prisma.studentProfile.count(),
		prisma.lecturerProfile.count(),
		prisma.class.count(),
		prisma.course.count(),
		prisma.user.count({ where: { status: "SUSPENDED" } }),
		prisma.class.count({ where: { courses: { none: {} } } }),
		prisma.course.count({ where: { lecturers: { none: {} } } }),
		prisma.class.count({ where: { students: { none: {} } } }),
		prisma.lecturerProfile.count({ where: { courses: { none: {} } } }),
		prisma.studentProfile.count({ where: { classId: null } }),
		prisma.course.count({ where: { classes: { none: {} } } }),
		getRecentAuditLogs(5),
	]);

	const stats = [
		{ label: "Students", value: studentCount.toLocaleString() },
		{ label: "Lecturers", value: lecturerCount.toLocaleString() },
		{ label: "Classes", value: classCount.toLocaleString() },
		{ label: "Courses", value: courseCount.toLocaleString() },
	];

	const structuralStats = [
		{ label: "Suspended Accounts", value: suspendedCount.toString(), tone: "#DC2626" },
		{ label: "Classes Without Courses", value: classesWithoutCoursesCount.toString(), tone: "#D97706" },
		{ label: "Courses Without Lecturers", value: coursesWithoutLecturersCount.toString(), tone: "#1967D2" },
	];

	const auditAlerts: string[] = [];
	if (classesWithoutStudentsCount > 0) {
		auditAlerts.push(`${classesWithoutStudentsCount} classes have no students enrolled.`);
	}
	if (lecturersWithoutCoursesCount > 0) {
		auditAlerts.push(`${lecturersWithoutCoursesCount} lecturers have no courses assigned.`);
	}
	if (studentsWithoutClassesCount > 0) {
		auditAlerts.push(`${studentsWithoutClassesCount} students are not attached to any class.`);
	}
	if (coursesWithoutLecturersCount > 0) {
		auditAlerts.push(`${coursesWithoutLecturersCount} courses need lecturer assignment.`);
	}
    if (classesWithoutCoursesCount > 0) {
        auditAlerts.push(`${classesWithoutCoursesCount} classes have no courses assigned.`);
    }
	if (coursesWithoutClassesCount > 0) {
		auditAlerts.push(`${coursesWithoutClassesCount} courses are not assigned to any classes.`);
	}

	return {
		stats,
		structuralStats,
		auditLogs: auditLogs.map(log => ({
            id: log.id,
            action: log.action,
            details: log.details,
            category: log.category,
            timestamp: log.createdAt,
        })),
		auditAlerts: auditAlerts.length > 0 ? auditAlerts : ["System is healthy. No critical issues found."],
        healthStatus: auditAlerts.length > 0 ? "Warning" : "Healthy"
	};
}
