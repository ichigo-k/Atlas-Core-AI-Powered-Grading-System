import { prisma } from "@/lib/prisma";
import { computeGrade, parseGradingScale } from "@/lib/grading-scale";

export type CoursePerformance = {
  courseId: number;
  courseCode: string;
  courseTitle: string;
  assessments: {
    id: number;
    title: string;
    type: string;
    totalMarks: number;
    score: number;
    grade: string;
    submittedAt: Date;
  }[];
  avgScore: number;
  avgGrade: string;
};

export type GradesData = {
  overallAvg: number | null;
  overallGrade: string | null;
  totalCompleted: number;
  courseBreakdown: CoursePerformance[];
  trendPoints: { label: string; score: number; date: string }[];
};

export async function getGradesData(studentId: number): Promise<GradesData> {
  const [profile, settings] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: studentId }, select: { classId: true } }),
    prisma.systemSettings.findUnique({ where: { id: 1 }, select: { gradingScale: true } }),
  ]);

  if (!profile?.classId) {
    return { overallAvg: null, overallGrade: null, totalCompleted: 0, courseBreakdown: [], trendPoints: [] };
  }

  const scale = parseGradingScale(settings?.gradingScale ?? null);

  const rows = await prisma.assessmentClass.findMany({
    where: { classId: profile.classId },
    select: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          resultsReleased: true,
          course: { select: { id: true, code: true, title: true } },
          attempts: {
            where: { studentId, status: { in: ["SUBMITTED", "TIMED_OUT"] } },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { score: true, submittedAt: true },
          },
        },
      },
    },
  });

  type Entry = {
    courseId: number;
    courseCode: string;
    courseTitle: string;
    assessmentId: number;
    title: string;
    type: string;
    totalMarks: number;
    score: number;
    grade: string;
    submittedAt: Date;
  };

  const entries: Entry[] = [];
  for (const row of rows) {
    const a = row.assessment;
    if (!a.resultsReleased) continue;
    const attempt = a.attempts[0];
    if (!attempt?.submittedAt) continue;
    const score = attempt.score ?? 0;
    const grade = computeGrade(score, a.totalMarks, scale);
    entries.push({
      courseId: a.course.id,
      courseCode: a.course.code,
      courseTitle: a.course.title,
      assessmentId: a.id,
      title: a.title,
      type: a.type,
      totalMarks: a.totalMarks,
      score,
      grade,
      submittedAt: attempt.submittedAt,
    });
  }

  if (entries.length === 0) {
    return { overallAvg: null, overallGrade: null, totalCompleted: 0, courseBreakdown: [], trendPoints: [] };
  }

  // Course breakdown
  const courseMap = new Map<number, CoursePerformance>();
  for (const e of entries) {
    if (!courseMap.has(e.courseId)) {
      courseMap.set(e.courseId, {
        courseId: e.courseId,
        courseCode: e.courseCode,
        courseTitle: e.courseTitle,
        assessments: [],
        avgScore: 0,
        avgGrade: "",
      });
    }
    courseMap.get(e.courseId)!.assessments.push({
      id: e.assessmentId,
      title: e.title,
      type: e.type,
      totalMarks: e.totalMarks,
      score: e.score,
      grade: e.grade,
      submittedAt: e.submittedAt,
    });
  }

  const courseBreakdown: CoursePerformance[] = [];
  for (const c of courseMap.values()) {
    const pcts = c.assessments.map((a) => (a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0));
    const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length;
    c.avgScore = Math.round(avg * 10) / 10;
    c.avgGrade = computeGrade(avg, 100, scale);
    courseBreakdown.push(c);
  }
  courseBreakdown.sort((a, b) => b.avgScore - a.avgScore);

  // Overall avg (percentage-based so scores across different totalMarks are comparable)
  const allPcts = entries.map((e) => (e.totalMarks > 0 ? (e.score / e.totalMarks) * 100 : 0));
  const overallAvg = Math.round((allPcts.reduce((s, v) => s + v, 0) / allPcts.length) * 10) / 10;
  const overallGrade = computeGrade(overallAvg, 100, scale);

  // Trend — last 10 graded assessments sorted by submission date
  const trendPoints = entries
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(-10)
    .map((e) => ({
      label: e.title.length > 12 ? e.title.slice(0, 12) + "…" : e.title,
      score: Math.round((e.totalMarks > 0 ? (e.score / e.totalMarks) * 100 : 0) * 10) / 10,
      date: e.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    }));

  return { overallAvg, overallGrade, totalCompleted: entries.length, courseBreakdown, trendPoints };
}
