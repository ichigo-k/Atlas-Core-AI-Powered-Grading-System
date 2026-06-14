import { redirect } from "next/navigation";
import AdminSidebar from "@/components/layout/AdminSidebar";
import StudentFooter from "@/components/layout/StudentFooter";
import { getSession } from "@/lib/session";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session || session.user.role !== "ADMIN") {
		redirect("/");
	}

	return (
		<div className="min-h-screen bg-[#f8fafd]">
			<div className="flex min-h-[calc(100vh-2.5rem)] flex-col xl:flex-row">
				<AdminSidebar userName={session.user.name} />
				<main className="w-full flex-1 p-3 md:p-5 xl:p-6">{children}</main>
			</div>
			<StudentFooter />
		</div>
	);
}
