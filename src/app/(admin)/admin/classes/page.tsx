import { FolderKanban } from "lucide-react";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { AdminClassesSkeleton } from "@/components/ui/page-loaders";
import ClassesTable from "./ClassesTable";

export default function AdminClassesPage() {
	return (
		<AdminPageShell
			title="Classes"
			description="Manage academic groups, their students, and course assignments."
			icon={FolderKanban}
		>
			<div className="hidden md:block">
				<Suspense fallback={<AdminClassesSkeleton />}>
					<ClassesTable />
				</Suspense>
			</div>

			<div className="mt-6 flex flex-col items-center justify-center rounded-sm border border-border bg-white px-4 py-10 text-center md:hidden">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
					<FolderKanban size={24} />
				</div>
				<p className="mb-2 text-sm font-semibold text-slate-900">
					Desktop or tablet required
				</p>
				<p className="max-w-[280px] text-sm text-slate-500">
					The classes directory is optimized for larger screens. Please access
					this portal on a tablet or desktop to manage classes.
				</p>
			</div>
		</AdminPageShell>
	);
}
