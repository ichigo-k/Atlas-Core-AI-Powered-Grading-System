"use client";

import {
	Award,
	BookOpen,
	GraduationCap,
	Hash,
	Save,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	createCourseAction,
	updateCourseAction,
	updateCourseAssignmentsAction,
} from "@/app/actions/admin-courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

interface AddEditCourseSheetProps {
	course: any | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes: any[];
	lecturers: any[];
}

export default function AddEditCourseSheet({
	course,
	open,
	onOpenChange,
	classes,
	lecturers,
}: AddEditCourseSheetProps) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [selectedLecturerIds, setSelectedLecturerIds] = useState<
		(string | number)[]
	>([]);
	const [selectedClassIds, setSelectedClassIds] = useState<(string | number)[]>(
		[],
	);

	useEffect(() => {
		if (course) {
			setSelectedLecturerIds(course.lecturers.map((l: any) => l.id));
			setSelectedClassIds(course.classes.map((c: any) => c.id));
		} else {
			setSelectedLecturerIds([]);
			setSelectedClassIds([]);
		}
	}, [course, open]);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		try {
			const result = course
				? await updateCourseAction(course.id, formData)
				: await createCourseAction(formData);

			if (result.success) {
				// If it's an edit, also update assignments
				if (course) {
					const assignmentResult = await updateCourseAssignmentsAction(
						course.id,
						selectedLecturerIds as number[],
						selectedClassIds as number[],
					);
					if (!assignmentResult.success) {
						toast.error(
							assignmentResult.error ||
								"Course updated but failed to update assignments",
						);
					}
				}

				toast.success(`Course ${course ? "updated" : "created"} successfully`);
				onOpenChange(false);
				router.refresh();
			} else {
				toast.error(
					result.error || `Failed to ${course ? "update" : "create"} course`,
				);
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	const lecturerOptions = lecturers.map((l: any) => ({
		label: l.user.name || "Unnamed Lecturer",
		value: l.id,
	}));

	const classOptions = classes.map((c: any) => ({
		label: `${c.name} (L${c.level})`,
		value: c.id,
	}));

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[540px] p-0 border-l border-border">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="text-left flex-1">
								<SheetTitle className="text-xl font-bold text-slate-900">
									{course ? "Edit Course" : "Add New Course"}
								</SheetTitle>
								<SheetDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
									{course
										? `Course ID: ${course.code}`
										: "Define a new academic course"}
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<form
							id="course-form"
							action={handleSubmit}
							className="p-8 space-y-8"
						>
							<div className="space-y-6">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label
											htmlFor="code"
											className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
										>
											Course Code
										</Label>
										<div className="relative group">
											<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
												<Hash size={18} />
											</div>
											<Input
												id="code"
												name="code"
												defaultValue={course?.code || ""}
												placeholder="e.g. CS101"
												className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all font-mono uppercase"
											/>
										</div>
									</div>

									<div className="space-y-2">
										<Label
											htmlFor="credits"
											className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
										>
											Credits
										</Label>
										<div className="relative group">
											<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
												<Award size={18} />
											</div>
											<Input
												id="credits"
												name="credits"
												type="number"
												min="1"
												max="10"
												defaultValue={course?.credits || 3}
												className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
											/>
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<Label
										htmlFor="title"
										className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
									>
										Course Title
									</Label>
									<div className="relative group">
										<Input
											id="title"
											name="title"
											defaultValue={course?.title || ""}
											placeholder="e.g. Introduction to Computer Science"
											className="h-11 px-4 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
										/>
									</div>
								</div>

								<div className="pt-4 border-t border-slate-100 space-y-6">
									<div className="space-y-2">
										<Label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight flex items-center gap-2">
											<Users size={14} className="text-slate-400" />
											Assigned Lecturers
										</Label>
										<MultiSelect
											options={lecturerOptions}
											selected={selectedLecturerIds}
											onChange={setSelectedLecturerIds}
											placeholder="Select lecturers to assign..."
										/>
									</div>

									<div className="space-y-2">
										<Label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight flex items-center gap-2">
											<GraduationCap size={14} className="text-slate-400" />
											Assigned Classes
										</Label>
										<MultiSelect
											options={classOptions}
											selected={selectedClassIds}
											onChange={setSelectedClassIds}
											placeholder="Select classes to link..."
										/>
									</div>
								</div>
							</div>
						</form>
					</div>

					<div className="p-8 border-t border-slate-100 bg-slate-50/50">
						<Button
							type="submit"
							form="course-form"
							className="w-full h-12 bg-[#002388] hover:bg-[#001570] text-white font-bold rounded-sm transition-all flex items-center justify-center gap-2"
							disabled={loading}
						>
							<Save size={18} />
							{loading
								? "Saving..."
								: course
									? "Save Changes"
									: "Create Course"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
