import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getLecturerId(email: string) {
	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true },
	});
	return user?.id ?? null;
}

export async function GET() {
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

		const assessments = await prisma.assessment.findMany({
			where: { lecturerId, status: { not: "DRAFT" } },
			select: {
				id: true,
				totalMarks: true,
				course: { select: { id: true, code: true, title: true } },
				classes: {
					select: {
						class: {
							select: {
								id: true,
								name: true,
								level: true,
								students: {
									select: {
										indexNumber: true,
										user: { select: { id: true, name: true, email: true } },
									},
								},
							},
						},
					},
				},
			},
		});

		const allStudentIds = new Set<number>();
		const allAssessmentIds = assessments.map((assessment) => assessment.id);

		for (const assessment of assessments) {
			for (const assessmentClass of assessment.classes) {
				for (const studentProfile of assessmentClass.class.students) {
					allStudentIds.add(studentProfile.user.id);
				}
			}
		}

		const attempts = await prisma.assessmentAttempt.findMany({
			where: {
				assessmentId: { in: allAssessmentIds },
				studentId: { in: Array.from(allStudentIds) },
				status: { in: ["SUBMITTED", "TIMED_OUT"] },
			},
			select: { assessmentId: true, studentId: true, score: true },
			orderBy: { score: "desc" },
		});

		const bestScore = new Map<string, number | null>();
		for (const attempt of attempts) {
			const key = `${attempt.studentId}:${attempt.assessmentId}`;
			if (!bestScore.has(key)) bestScore.set(key, attempt.score);
		}

		const studentMap = new Map<
			number,
			{
				id: number;
				name: string;
				email: string;
				indexNumber: string | null;
				classId: number;
				className: string;
				classLevel: number;
				assessmentIds: Set<number>;
				courseIds: Set<number>;
				totalEarned: number;
				totalPossible: number;
			}
		>();

		for (const assessment of assessments) {
			for (const assessmentClass of assessment.classes) {
				for (const studentProfile of assessmentClass.class.students) {
					const studentId = studentProfile.user.id;
					if (!studentMap.has(studentId)) {
						studentMap.set(studentId, {
							id: studentId,
							name: studentProfile.user.name ?? "Unknown",
							email: studentProfile.user.email,
							indexNumber: studentProfile.indexNumber ?? null,
							classId: assessmentClass.class.id,
							className: assessmentClass.class.name,
							classLevel: assessmentClass.class.level,
							assessmentIds: new Set(),
							courseIds: new Set(),
							totalEarned: 0,
							totalPossible: 0,
						});
					}
					const entry = studentMap.get(studentId);
					if (!entry) continue;

					if (!entry.assessmentIds.has(assessment.id)) {
						entry.assessmentIds.add(assessment.id);
						entry.courseIds.add(assessment.course.id);
						const score = bestScore.get(`${studentId}:${assessment.id}`) ?? 0;
						entry.totalEarned += score;
						entry.totalPossible += assessment.totalMarks;
					}
				}
			}
		}

		const coursesMap = new Map<
			number,
			{ id: number; code: string; title: string }
		>();
		const classesMap = new Map<
			number,
			{ id: number; name: string; level: number }
		>();

		for (const assessment of assessments) {
			coursesMap.set(assessment.course.id, assessment.course);
			for (const assessmentClass of assessment.classes) {
				classesMap.set(assessmentClass.class.id, {
					id: assessmentClass.class.id,
					name: assessmentClass.class.name,
					level: assessmentClass.class.level,
				});
			}
		}

		const students = Array.from(studentMap.values()).map((student) => ({
			id: student.id,
			name: student.name,
			email: student.email,
			indexNumber: student.indexNumber,
			classId: student.classId,
			className: student.className,
			classLevel: student.classLevel,
			assessmentCount: student.assessmentIds.size,
			courseIds: Array.from(student.courseIds),
			totalEarned: student.totalEarned,
			totalPossible: student.totalPossible,
			overallPct:
				student.totalPossible > 0
					? Math.round((student.totalEarned / student.totalPossible) * 100)
					: null,
		}));

		const levels = Array.from(
			new Set(students.map((student) => student.classLevel)),
		).sort((a, b) => a - b);

		return NextResponse.json({
			students,
			courses: Array.from(coursesMap.values()),
			classes: Array.from(classesMap.values()),
			levels,
		});
	} catch (err) {
		console.error("[GET /api/lecturer/gradebook] Failed to load gradebook", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
	}
}
