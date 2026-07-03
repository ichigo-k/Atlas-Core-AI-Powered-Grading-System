import { Building2 } from "lucide-react";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { AdminFacultiesSkeleton } from "@/components/ui/page-loaders";
import { getFaculties } from "@/lib/admin-entities";
import FacultiesClient from "./FacultiesClient";

async function FacultiesDataWrapper() {
	const faculties = await getFaculties();
	return <FacultiesClient initialFaculties={faculties} />;
}

export default function AdminFacultiesPage() {
	return (
		<AdminPageShell
			title="Faculties"
			description="Manage institutional faculties and related programs."
			icon={Building2}
		>
			<div className="hidden md:block">
				<Suspense fallback={<AdminFacultiesSkeleton />}>
					<FacultiesDataWrapper />
				</Suspense>
			</div>

			<div className="mt-6 flex flex-col items-center justify-center rounded-sm border border-border bg-white px-4 py-10 text-center md:hidden">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
					<Building2 size={24} />
				</div>
				<p className="mb-2 text-sm font-semibold text-slate-900">
					Desktop or tablet required
				</p>
				<p className="max-w-[280px] text-sm text-slate-500">
					The faculties directory is optimized for larger screens. Please access
					on a tablet or desktop to manage faculties.
				</p>
			</div>
		</AdminPageShell>
	);
}
