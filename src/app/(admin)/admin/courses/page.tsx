import { BookOpen } from "lucide-react";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import LoadingLogo from "@/components/ui/LoadingLogo";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getClasses, getCoursesWithDetails } from "@/lib/admin-classes";
import { getLecturers } from "@/lib/admin-users";
import AddCourseButton from "./AddCourseButton";
import CoursesClient from "./CoursesClient";

async function CoursesDataWrapper() {
	const [courses, classes, lecturers] = await Promise.all([
		getCoursesWithDetails(),
		getClasses(),
		getLecturers(),
	]);

	return (
		<CoursesClient courses={courses} classes={classes} lecturers={lecturers} />
	);
}

export default function AdminCoursesPage() {
	return (
		<AdminPageShell
			title="Course catalog"
			description="Manage academic courses, lecturer assignments, and class linkages."
			icon={BookOpen}
			actions={<AddCourseButton />}
		>
			<div className="hidden md:block">
				<Suspense
					fallback={
						<div className="relative rounded-lg border border-slate-200 bg-white p-4">
							<TableSkeleton />
							<div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
								<div className="scale-75 opacity-80">
									<LoadingLogo />
								</div>
							</div>
						</div>
					}
				>
					<CoursesDataWrapper />
				</Suspense>
			</div>

			<div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-10 text-center md:hidden">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
					<BookOpen size={24} />
				</div>
				<p className="mb-2 text-sm font-semibold text-slate-900">
					Desktop or tablet required
				</p>
				<p className="max-w-[280px] text-sm text-slate-500">
					The course catalog is optimized for larger screens. Please access this
					portal on a tablet or desktop to manage courses.
				</p>
			</div>
		</AdminPageShell>
	);
}
