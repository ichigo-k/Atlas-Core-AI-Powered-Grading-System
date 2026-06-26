import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getScheduleAssessments } from "@/lib/student-queries";
import ScheduleClient from "./ScheduleClient";

export default async function StudentSchedulePage() {
	const session = await getSession();
	const email = session?.user?.email;

	const user = email
		? await prisma.user.findUnique({ where: { email }, select: { id: true } })
		: null;

	const studentId = user?.id ?? null;

	const raw = studentId ? await getScheduleAssessments(studentId) : [];

	// Serialize Dates to ISO strings for the client component
	const items = raw.map((a: any) => ({
		id: a.id,
		title: a.title,
		type: a.type,
		courseTitle: a.courseTitle,
		courseCode: a.courseCode,
		startsAt: a.startsAt.toISOString(),
		endsAt: a.endsAt.toISOString(),
		durationMinutes: a.durationMinutes,
		location: a.location,
		status: a.status,
		passwordProtected: a.passwordProtected,
		proctoringEnabled: a.proctoringEnabled,
	}));

	return <ScheduleClient items={items} />;
}
