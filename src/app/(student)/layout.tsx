import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import StudentShell from "@/components/layout/StudentShell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.user.role !== "STUDENT") {
    redirect("/");
  }

  // Bare layout for the in-exam attempt page (no nav chrome)
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isAttemptPage =
    pathname.includes("/assessments/") && pathname.includes("/attempt");

  if (isAttemptPage) {
    return <>{children}</>;
  }

  // Get ongoing count for the nav badge (non-critical — fails silently)
  let ongoingCount = 0;
  const email = session.user.email;

  if (email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user) {
        const profile = await prisma.studentProfile.findUnique({
          where: { id: user.id },
          select: { classId: true },
        });
        if (profile?.classId) {
          const now = new Date();
          ongoingCount = await prisma.assessmentClass.count({
            where: {
              classId: profile.classId,
              assessment: {
                status: "PUBLISHED",
                startsAt: { lte: now },
                endsAt: { gte: now },
              },
            },
          });
        }
      }
    } catch (err) {
      console.error("[StudentLayout] failed to fetch ongoing count", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <StudentShell
      userName={session.user.name}
      userEmail={session.user.email}
      ongoingCount={ongoingCount}
    >
      {children}
    </StudentShell>
  );
}
