import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

	// Check if this is the exam attempt page — if so, render bare (no nav)
	const headersList = await headers();
	const pathname = headersList.get("x-pathname") || "";
	const isAttemptPage = pathname.includes("/assessments/") && pathname.includes("/attempt");

	if (isAttemptPage) {
		return <>{children}</>;
	}

	return (
		<div className="flex min-h-screen bg-discord-sidebar">
			<StudentNavbar userName={session.user.name} />
			<main className="ml-[72px] flex-1 overflow-hidden p-2">
				<div className="h-full w-full overflow-y-auto rounded-tl-2xl bg-[#f8f9fa] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
					<div className="px-4 py-6 md:px-8">
						{children}
					</div>
				</div>
			</main>
		</div>
	);
}
