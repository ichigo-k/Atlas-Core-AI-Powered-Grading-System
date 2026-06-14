import { redirect } from "next/navigation";
import { headers } from "next/headers";
import StudentFooter from "@/components/layout/StudentFooter";
import StudentNavbar from "@/components/layout/StudentNavbar";
import { getSession } from "@/lib/session";

export default async function StudentLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session || session.user.role !== "STUDENT") {
		redirect("/");
	}

	// Check if this is the exam attempt page — if so, render bare (no nav/footer)
	const headersList = await headers();
	const pathname = headersList.get("x-pathname") || "";
	const isAttemptPage = pathname.includes("/assessments/") && pathname.includes("/attempt");

	if (isAttemptPage) {
		return <>{children}</>;
	}

	return (
		<div className="min-h-screen flex flex-col bg-[#f8f9fa]">
			<StudentNavbar userName={session.user.name} />
			<main className="flex-1 px-4 md:px-8 py-6 animate-in fade-in duration-500">
				{children}
			</main>
			<StudentFooter />
		</div>
	);
}

