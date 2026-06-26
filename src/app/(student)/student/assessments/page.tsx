import { getSession } from "@/lib/session";
import { getStudentAssessments } from "@/lib/student-queries";
import { prisma } from "@/lib/prisma";
import AssessmentsClient from "./AssessmentsClient";

export default async function StudentAssessmentsPage() {
	const session = await getSession();
	const email = session?.user?.email;
	const user = email
		? await prisma.user.findUnique({ where: { email }, select: { id: true } })
		: null;

	const studentId = user?.id ?? null;
	const rawAssessments = studentId ? await getStudentAssessments(studentId) : [];

	// Serialize Date objects to ISO strings for client component
	const assessments = rawAssessments.map((a: any) => ({
		...a,
		startsAt: a.startsAt.toISOString(),
		endsAt: a.endsAt.toISOString(),
	}));

	// Derive unique courses list from assessments
	const coursesMap = new Map<number, { id: number; code: string; title: string }>();
	for (const a of rawAssessments) {
		if (!coursesMap.has(a.courseId)) {
			coursesMap.set(a.courseId, { id: a.courseId, code: a.courseCode, title: a.courseTitle });
		}
	}
	const courses = Array.from(coursesMap.values());

	return <AssessmentsClient assessments={assessments} courses={courses} />;
}
