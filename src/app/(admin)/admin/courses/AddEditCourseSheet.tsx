"use client";

import {
	Award,
	BookOpen,
	GraduationCap,
	Hash,
	Loader2,
	Save,
	Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	createCourseAction,
	updateCourseAssignmentsAction,
} from "@/app/actions/admin-courses";
import { AsyncMultiSelect, type AsyncOption } from "@/components/ui/async-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

interface AddEditCourseSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function AddEditCourseSheet({
	open,
	onOpenChange,
}: AddEditCourseSheetProps) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const submittingRef = useRef(false);
	const [selectedLecturers, setSelectedLecturers] = useState<AsyncOption[]>([]);
	const [selectedClasses, setSelectedClasses] = useState<AsyncOption[]>([]);

	useEffect(() => {
		if (open) {
			setSelectedLecturers([]);
			setSelectedClasses([]);
		}
	}, [open]);

	async function handleSubmit(formData: FormData) {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setLoading(true);
		try {
			const result = await createCourseAction(formData);

			if (result.success) {
				const courseId = (result as any).courseId;
				if (courseId && (selectedLecturers.length > 0 || selectedClasses.length > 0)) {
					const assignmentResult = await updateCourseAssignmentsAction(
						courseId,
						selectedLecturers.map((l) => Number(l.id)),
						selectedClasses.map((c) => Number(c.id)),
					);
					if (!assignmentResult.success) {
						toast.error(
							assignmentResult.error || "Course created but failed to save assignments",
						);
					}
				}

				toast.success("Course created successfully");
				onOpenChange(false);
				router.refresh();
			} else {
				toast.error(result.error || "Failed to create course");
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
			submittingRef.current = false;
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-2xl p-0 border-l border-border">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="text-left flex-1">
								<SheetTitle className="text-xl font-bold text-slate-900">
									Add New Course
								</SheetTitle>
								<SheetDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
									Define a new academic course
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
												defaultValue={3}
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
										<AsyncMultiSelect
											searchUrl="/api/admin/lecturers/search"
											selected={selectedLecturers}
											onChange={setSelectedLecturers}
											placeholder="Search lecturers by name or email..."
											searchPlaceholder="Type to search lecturers..."
										/>
									</div>

									<div className="space-y-2">
										<Label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight flex items-center gap-2">
											<GraduationCap size={14} className="text-slate-400" />
											Assigned Classes
										</Label>
										<AsyncMultiSelect
											searchUrl="/api/admin/classes/search"
											selected={selectedClasses}
											onChange={setSelectedClasses}
											placeholder="Search classes by name..."
											searchPlaceholder="Type to search classes..."
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
							{loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
							{loading ? "Saving..." : "Create Course"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
