import { Users as UsersIcon } from "lucide-react";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { AdminUsersSkeleton } from "@/components/ui/page-loaders";
import UsersTable from "./UsersTable";

export default function AdminUsersPage() {
	return (
		<AdminPageShell
			title="User directory"
			description="Manage students, lecturers, and administrative staff from one central directory."
			icon={UsersIcon}
		>
			<div className="hidden md:block">
				<Suspense fallback={<AdminUsersSkeleton />}>
					<UsersTable />
				</Suspense>
			</div>

			<div className="mt-6 flex flex-col items-center justify-center rounded-sm border border-border bg-white px-4 py-10 text-center md:hidden">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
					<UsersIcon size={24} />
				</div>
				<p className="mb-2 text-sm font-semibold text-slate-900">
					Desktop or tablet required
				</p>
				<p className="max-w-[280px] text-sm text-slate-500">
					The user directory is optimized for larger screens. Please access this
					portal on a tablet or desktop to manage users.
				</p>
			</div>
		</AdminPageShell>
	);
}
