"use client";

import {
	Award,
	BookOpen,
	FolderKanban,
	Hash,
	Loader2,
	Save,
	Trash2,
	Users as UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	deleteCourseAction,
	toggleCourseClassAction,
	toggleCourseLecturerAction,
	updateCourseAction,
} from "@/app/actions/admin-courses";
import { AssignmentChecklist } from "@/components/ui/assignment-checklist";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableDrawer } from "@/components/ui/resizable-drawer";
import type { ClassWithDetails, CourseWithDetails } from "@/lib/admin-classes";

type Lecturer = {
	id: number;
	user: { name: string | null; email: string };
};

type TabKey = "overview" | "lecturers" | "classes";

const tabs: { key: TabKey; label: string; Icon: typeof UsersIcon }[] = [
	{ key: "overview", label: "Overview", Icon: BookOpen },
	{ key: "lecturers", label: "Lecturers", Icon: UsersIcon },
	{ key: "classes", label: "Classes", Icon: FolderKanban },
];

interface CourseDetailSheetProps {
	course: CourseWithDetails | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialTab?: TabKey;
	classes: ClassWithDetails[];
	lecturers: Lecturer[];
}

export default function CourseDetailSheet({
	course,
	open,
	onOpenChange,
	initialTab = "overview",
	classes,
	lecturers,
}: CourseDetailSheetProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
	const [isSaving, setIsSaving] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (open) setActiveTab(initialTab);
	}, [open, initialTab, course?.id]);

	if (!course) return null;

	const assignedLecturerIds = new Set(course.lecturers.map((l) => l.id));
	const assignedClassIds = new Set(course.classes.map((c) => c.id));

	async function handleSubmit(formData: FormData) {
		if (!course) return;
		setIsSaving(true);
		try {
			const result = await updateCourseAction(course.id, formData);
			if (result.success) {
				toast.success("Course updated successfully");
				router.refresh();
			} else {
				toast.error(result.error || "Failed to update course");
			}
		} finally {
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!course) return;
		setIsDeleting(true);
		try {
			const result = await deleteCourseAction(course.id);
			if (result.success) {
				toast.success("Course deleted successfully");
				setDeleteOpen(false);
				onOpenChange(false);
				router.refresh();
			} else {
				toast.error(result.error || "Failed to delete course");
				setDeleteOpen(false);
			}
		} finally {
			setIsDeleting(false);
		}
	}

	async function handleToggleLecturer(id: number, isAssigned: boolean) {
		if (!course) return;
		const result = await toggleCourseLecturerAction(course.id, id, isAssigned);
		if (result.success) {
			toast.success(`Lecturer ${isAssigned ? "unassigned" : "assigned"} successfully`);
			router.refresh();
		} else {
			toast.error(result.error || "Failed to update assignment");
		}
	}

	async function handleToggleClass(id: number, isAssigned: boolean) {
		if (!course) return;
		const result = await toggleCourseClassAction(course.id, id, isAssigned);
		if (result.success) {
			toast.success(`Class ${isAssigned ? "unassigned" : "assigned"} successfully`);
			router.refresh();
		} else {
			toast.error(result.error || "Failed to update assignment");
		}
	}

	return (
		<ResizableDrawer open={open} onOpenChange={onOpenChange}>
			<ConfirmModal
				open={deleteOpen}
				title="Delete Course?"
				description={`Are you sure you want to delete ${course.code}: ${course.title}? This action will remove the course and all its associations. It cannot be undone.`}
				confirmText="Delete Course"
				isDestructive
				isLoading={isDeleting}
				onConfirm={handleDelete}
				onCancel={() => setDeleteOpen(false)}
			/>

			<div className="shrink-0 px-6 pt-1 pb-4 bg-slate-50/50 border-b border-slate-100 text-left">
				<div className="mx-auto w-full max-w-3xl flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] text-[#002388] shrink-0">
						<BookOpen size={22} />
					</div>
					<div className="text-left min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-lg font-bold text-slate-900 truncate">
								{course.title}
							</h2>
							<span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border bg-white text-slate-600 border-border shrink-0">
								{course.code}
							</span>
						</div>
						<div className="flex items-center gap-4 mt-1 text-[12px] text-muted-foreground">
							<span>
								<span className="font-semibold text-slate-700">{course.credits}</span> credits
							</span>
							<span>
								<span className="font-semibold text-slate-700">{course.lecturers.length}</span> lecturer
								{course.lecturers.length === 1 ? "" : "s"}
							</span>
							<span>
								<span className="font-semibold text-slate-700">{course.classes.length}</span> class
								{course.classes.length === 1 ? "" : "es"}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto">
				<div className="p-6 pt-5 space-y-5 mx-auto w-full max-w-3xl">
					{/* Tabs */}
					<div className="flex items-center gap-6 border-b border-border">
						{tabs.map(({ key, label, Icon }) => {
							const active = activeTab === key;
							return (
								<button
									type="button"
									key={key}
									onClick={() => setActiveTab(key)}
									className={`group relative flex items-center gap-2 pb-3 text-sm transition-colors ${
										active
											? "text-[#002388] font-semibold"
											: "text-slate-500 font-medium hover:text-slate-700"
									}`}
								>
									<Icon size={15} strokeWidth={active ? 2.5 : 2} />
									{label}
									{key === "lecturers" && (
										<span
											className={`flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
												active
													? "bg-[#002388] text-white"
													: "border border-border text-slate-500 bg-slate-50"
											}`}
										>
											{course.lecturers.length}
										</span>
									)}
									{key === "classes" && (
										<span
											className={`flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
												active
													? "bg-[#002388] text-white"
													: "border border-border text-slate-500 bg-slate-50"
											}`}
										>
											{course.classes.length}
										</span>
									)}
									{active && (
										<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#002388] rounded-t-full" />
									)}
								</button>
							);
						})}
					</div>

					{activeTab === "overview" && (
						<form action={handleSubmit} className="space-y-6">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="code" className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
										Course Code
									</Label>
									<div className="relative group">
										<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
											<Hash size={18} />
										</div>
										<Input
											id="code"
											name="code"
											defaultValue={course.code}
											className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all font-mono uppercase"
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="credits" className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
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
											defaultValue={course.credits}
											className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="title" className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
									Course Title
								</Label>
								<Input
									id="title"
									name="title"
									defaultValue={course.title}
									className="h-11 px-4 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
								/>
							</div>

							<div className="flex items-center justify-between pt-4 border-t border-slate-100">
								<Button
									type="button"
									variant="outline"
									onClick={() => setDeleteOpen(true)}
									className="h-10 gap-1.5 px-4 rounded-sm border-rose-200 text-rose-600 text-[12px] font-semibold hover:bg-rose-50"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete Course
								</Button>
								<Button
									type="submit"
									disabled={isSaving}
									className="h-10 gap-1.5 px-5 bg-[#002388] hover:bg-[#001570] text-white rounded-sm font-semibold text-[12px]"
								>
									{isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
									{isSaving ? "Saving..." : "Save Changes"}
								</Button>
							</div>
						</form>
					)}

					{activeTab === "lecturers" && (
						<AssignmentChecklist
							items={lecturers.map((l) => ({
								id: l.id,
								label: l.user.name || "Unnamed Lecturer",
								sublabel: l.user.email,
							}))}
							assignedIds={assignedLecturerIds}
							onToggle={handleToggleLecturer}
							searchPlaceholder="Search lecturers by name or email..."
							emptyMessage="No lecturers found in the system."
						/>
					)}

					{activeTab === "classes" && (
						<AssignmentChecklist
							items={classes.map((c) => ({
								id: c.id,
								label: c.name,
								sublabel: `L${c.level}`,
							}))}
							assignedIds={assignedClassIds}
							onToggle={handleToggleClass}
							searchPlaceholder="Search classes by name..."
							emptyMessage="No classes found in the system."
						/>
					)}
				</div>
			</div>
		</ResizableDrawer>
	);
}
