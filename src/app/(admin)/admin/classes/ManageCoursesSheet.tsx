"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ClassWithDetails, CourseSimple } from "@/lib/admin-classes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ManageCoursesSheet({
	open,
	onOpenChange,
	cls,
	allCourses,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cls: ClassWithDetails | null;
	allCourses: CourseSimple[];
}) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(new Set());

	useEffect(() => {
		if (open && cls) {
			setIsPending(true);
			fetch(`/api/admin/classes/${cls.id}/courses`)
				.then((res) => res.json())
				.then((data: CourseSimple[]) => {
					setSelectedCourseIds(new Set(data.map((c) => c.id)));
				})
				.finally(() => setIsPending(false));
		}
	}, [open, cls]);

	async function handleSave() {
		if (!cls) return;
		setIsPending(true);
		try {
			const res = await fetch(`/api/admin/classes/${cls.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ courseIds: Array.from(selectedCourseIds) }),
			});
			if (res.ok) {
				toast.success("Courses updated successfully");
				onOpenChange(false);
				router.refresh();
			} else {
				toast.error("Failed to update courses");
			}
		} catch {
			toast.error("An error occurred");
		} finally {
			setIsPending(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto p-6 flex flex-col h-full">
				<SheetHeader className="mb-6 text-left shrink-0">
					<SheetTitle className="text-xl font-bold text-slate-900">
						Manage Courses
					</SheetTitle>
					<SheetDescription className="text-sm text-slate-500">
						Assign or remove courses for {cls?.name} Level {cls?.level}.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto space-y-4 pr-2">
					{isPending && selectedCourseIds.size === 0 ? (
						<div className="flex justify-center mt-10">
							<Loader2 className="h-6 w-6 animate-spin text-[#002388]" />
						</div>
					) : allCourses.length === 0 ? (
						<p className="text-sm text-slate-500">No courses available in the system.</p>
					) : (
						allCourses.map((course) => (
							<div key={course.id} className="flex items-start space-x-3 p-3 rounded-sm border border-slate-100 hover:bg-slate-50 transition-colors">
								<Checkbox 
									id={`course-${course.id}`} 
									checked={selectedCourseIds.has(course.id)}
									onCheckedChange={(checked) => {
										const newSet = new Set(selectedCourseIds);
										if (checked) newSet.add(course.id);
										else newSet.delete(course.id);
										setSelectedCourseIds(newSet);
									}}
								/>
								<div className="space-y-1 leading-none">
									<Label htmlFor={`course-${course.id}`} className="font-semibold text-slate-700 cursor-pointer">
										{course.code} - {course.title}
									</Label>
									<p className="text-xs text-slate-500">{course.credits} Credits</p>
								</div>
							</div>
						))
					)}
				</div>

				<SheetFooter className="mt-6 pt-4 border-t border-slate-100 shrink-0">
					<Button
						onClick={handleSave}
						disabled={isPending}
						className="w-full bg-[#002388] hover:bg-[#001570] text-white rounded-sm h-10 font-medium transition-colors flex items-center justify-center gap-2"
					>
						{isPending && <Loader2 className="h-4 w-4 animate-spin" />}
						<span>Save Courses</span>
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}


