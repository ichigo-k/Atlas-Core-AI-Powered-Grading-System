import { redirect } from "next/navigation";
import AdminShell from "@/components/layout/AdminShell";
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

	if (session.user.mustChangePassword) {
		redirect("/force-change-password");
	}

	return (
		<AdminShell
			userName={session.user.name}
			userEmail={session.user.email}
		>
			{children}
		</AdminShell>
	);
}
