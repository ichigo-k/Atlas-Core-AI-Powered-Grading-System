"use client";

import { GraduationCap, Link as LinkIcon, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	toggleCourseClassAction,
	toggleCourseLecturerAction,
} from "@/app/actions/admin-courses";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

interface ManageAssignmentsSheetProps {
	course: any | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes: any[];
	lecturers: any[];
}

export default function ManageAssignmentsSheet({
	course,
	open,
	onOpenChange,
	classes,
	lecturers,
}: ManageAssignmentsSheetProps) {
	const [loadingId, setLoadingId] = useState<string | null>(null);

	if (!course) return null;

	const assignedClassIds = new Set(course.classes.map((c: any) => c.id));
	const assignedLecturerIds = new Set(course.lecturers.map((l: any) => l.id));

	async function handleToggleClass(classId: number, isAssigned: boolean) {
		const id = `class-${classId}`;
		setLoadingId(id);
		try {
			const result = await toggleCourseClassAction(
				course.id,
				classId,
				isAssigned,
			);
			if (result.success) {
				toast.success(
					`Class ${isAssigned ? "unassigned" : "assigned"} successfully`,
				);
			} else {
				toast.error(result.error || "Failed to update assignment");
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoadingId(null);
		}
	}

	async function handleToggleLecturer(lecturerId: number, isAssigned: boolean) {
		const id = `lecturer-${lecturerId}`;
		setLoadingId(id);
		try {
			const result = await toggleCourseLecturerAction(
				course.id,
				lecturerId,
				isAssigned,
			);
			if (result.success) {
				toast.success(
					`Lecturer ${isAssigned ? "unassigned" : "assigned"} successfully`,
				);
			} else {
				toast.error(result.error || "Failed to update assignment");
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoadingId(null);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[480px] p-0 border-l border-slate-200">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-[#002388]">
								<LinkIcon size={24} />
							</div>
							<div className="text-left">
								<SheetTitle className="text-xl font-bold text-slate-900">
									Manage Assignments
								</SheetTitle>
								<SheetDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
									Link classes and lecturers to {course.code}
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto p-8 space-y-10">
						{/* Classes Section */}
						<div className="space-y-4">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
									<GraduationCap size={14} />
									Assigned Classes
								</div>
								<Badge
									variant="secondary"
									className="rounded-md px-1.5 py-0 text-[10px]"
								>
									{course.classes.length}
								</Badge>
							</div>

							<div className="grid gap-2">
								{classes.map((cls) => {
									const isAssigned = assignedClassIds.has(cls.id);
									const loading = loadingId === `class-${cls.id}`;
									return (
										<div
											key={cls.id}
											className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
												isAssigned
													? "border-[#002388]/20 bg-[#002388]/5"
													: "border-slate-100 hover:border-slate-200"
											}`}
										>
											<div className="flex items-center gap-3">
												<Checkbox
													id={`class-${cls.id}`}
													checked={isAssigned}
													onCheckedChange={() =>
														handleToggleClass(cls.id, isAssigned)
													}
													disabled={!!loadingId}
												/>
												<label
													htmlFor={`class-${cls.id}`}
													className="text-sm font-semibold text-slate-700 cursor-pointer"
												>
													{cls.name}{" "}
													<span className="text-xs text-slate-400 font-medium ml-1">
														L{cls.level}
													</span>
												</label>
											</div>
											{loading && (
												<Loader2
													size={14}
													className="animate-spin text-[#002388]"
												/>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Lecturers Section */}
						<div className="space-y-4">
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
									<Users size={14} />
									Assigned Lecturers
								</div>
								<Badge
									variant="secondary"
									className="rounded-md px-1.5 py-0 text-[10px]"
								>
									{course.lecturers.length}
								</Badge>
							</div>

							<div className="grid gap-2">
								{lecturers.map((lec) => {
									const isAssigned = assignedLecturerIds.has(lec.id);
									const loading = loadingId === `lecturer-${lec.id}`;
									return (
										<div
											key={lec.id}
											className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
												isAssigned
													? "border-[#002388]/20 bg-[#002388]/5"
													: "border-slate-100 hover:border-slate-200"
											}`}
										>
											<div className="flex items-center gap-3">
												<Checkbox
													id={`lecturer-${lec.id}`}
													checked={isAssigned}
													onCheckedChange={() =>
														handleToggleLecturer(lec.id, isAssigned)
													}
													disabled={!!loadingId}
												/>
												<label
													htmlFor={`lecturer-${lec.id}`}
													className="text-sm font-semibold text-slate-700 cursor-pointer"
												>
													{lec.user.name || "Unnamed Lecturer"}
												</label>
											</div>
											{loading && (
												<Loader2
													size={14}
													className="animate-spin text-[#002388]"
												/>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
