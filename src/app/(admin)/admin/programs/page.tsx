import { School } from "lucide-react";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { AdminProgramsSkeleton } from "@/components/ui/page-loaders";
import { getFaculties, getPrograms } from "@/lib/admin-entities";
import ProgramsClient from "./ProgramsClient";

async function ProgramsDataWrapper() {
	const [programs, faculties] = await Promise.all([
		getPrograms(),
		getFaculties(),
	]);
	return <ProgramsClient initialPrograms={programs} faculties={faculties} />;
}

export default function AdminProgramsPage() {
	return (
		<AdminPageShell
			title="Programs"
			description="Manage academic programs and their faculty associations."
			icon={School}
		>
			<div className="hidden md:block">
				<Suspense fallback={<AdminProgramsSkeleton />}>
					<ProgramsDataWrapper />
				</Suspense>
			</div>

			<div className="mt-6 flex flex-col items-center justify-center rounded-sm border border-border bg-white px-4 py-10 text-center md:hidden">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
					<School size={24} />
				</div>
				<p className="mb-2 text-sm font-semibold text-slate-900">
					Desktop or tablet required
				</p>
				<p className="max-w-[280px] text-sm text-slate-500">
					The programs view is optimized for larger screens. Please access on a
					tablet or desktop to manage programs.
				</p>
			</div>
		</AdminPageShell>
	);
}
