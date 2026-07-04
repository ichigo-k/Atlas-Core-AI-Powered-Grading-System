"use client";

import {
	BookOpen,
	FolderKanban,
	Hash,
	Loader2,
	Save,
	Search,
	Trash2,
	Users as UsersIcon,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssignmentChecklist } from "@/components/ui/assignment-checklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableDrawer } from "@/components/ui/resizable-drawer";
import type { ClassWithDetails, CourseSimple } from "@/lib/admin-classes";

type Member = {
	id: number;
	name: string | null;
	email: string;
	status: string;
	program: string;
};

type TabKey = "overview" | "members" | "courses";

const tabs: { key: TabKey; label: string; Icon: typeof UsersIcon }[] = [
	{ key: "overview", label: "Overview", Icon: FolderKanban },
	{ key: "members", label: "Members", Icon: UsersIcon },
	{ key: "courses", label: "Courses", Icon: BookOpen },
];

interface ClassDetailSheetProps {
	cls: ClassWithDetails | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialTab?: TabKey;
	allCourses: CourseSimple[];
}

export default function ClassDetailSheet({
	cls,
	open,
	onOpenChange,
	initialTab = "overview",
	allCourses,
}: ClassDetailSheetProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

	// Overview
	const [name, setName] = useState("");
	const [level, setLevel] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// Members
	const [members, setMembers] = useState<Member[]>([]);
	const [membersLoading, setMembersLoading] = useState(false);
	const [memberSearch, setMemberSearch] = useState("");

	// Courses
	const [assignedCourseIds, setAssignedCourseIds] = useState<Set<number>>(new Set());
	const [coursesLoading, setCoursesLoading] = useState(false);

	useEffect(() => {
		if (open && cls) {
			setActiveTab(initialTab);
			setName(cls.name);
			setLevel(cls.level.toString());
			setMembers([]);
			setAssignedCourseIds(new Set());
			setMemberSearch("");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, cls?.id]);

	useEffect(() => {
		if (!open || !cls) return;
		if (activeTab === "members" && members.length === 0) {
			setMembersLoading(true);
			fetch(`/api/admin/classes/${cls.id}/members`)
				.then((res) => res.json())
				.then((data: Member[]) => setMembers(data))
				.finally(() => setMembersLoading(false));
		}
		if (activeTab === "courses" && assignedCourseIds.size === 0) {
			setCoursesLoading(true);
			fetch(`/api/admin/classes/${cls.id}/courses`)
				.then((res) => res.json())
				.then((data: CourseSimple[]) => setAssignedCourseIds(new Set(data.map((c) => c.id))))
				.finally(() => setCoursesLoading(false));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab, open, cls?.id]);

	const filteredMembers = useMemo(() => {
		const query = memberSearch.trim().toLowerCase();
		if (!query) return members;
		return members.filter(
			(m) =>
				m.name?.toLowerCase().includes(query) ||
				m.email.toLowerCase().includes(query) ||
				m.program?.toLowerCase().includes(query),
		);
	}, [members, memberSearch]);

	if (!cls) return null;

	async function handleSaveOverview() {
		if (!cls || !name.trim() || !level) return;
		setIsSaving(true);
		try {
			const res = await fetch(`/api/admin/classes/${cls.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, level }),
			});
			if (res.ok) {
				toast.success("Class updated successfully");
				router.refresh();
			} else if (res.status === 409) {
				toast.error("A class with this name and level already exists.");
			} else {
				toast.error("Something went wrong. Please try again.");
			}
		} catch {
			toast.error("An error occurred. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!cls) return;
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/admin/classes/${cls.id}`, { method: "DELETE" });
			if (res.ok) {
				toast.success("Class deleted successfully");
				setDeleteOpen(false);
				onOpenChange(false);
				router.refresh();
			} else {
				const data = await res.json().catch(() => null);
				toast.error(data?.error || "Failed to delete class");
				setDeleteOpen(false);
			}
		} catch {
			toast.error("Failed to delete class");
			setDeleteOpen(false);
		} finally {
			setIsDeleting(false);
		}
	}

	async function handleToggleCourse(id: number, isAssigned: boolean) {
		if (!cls) return;
		const nextIds = new Set(assignedCourseIds);
		if (isAssigned) nextIds.delete(id);
		else nextIds.add(id);

		try {
			const res = await fetch(`/api/admin/classes/${cls.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ courseIds: Array.from(nextIds) }),
			});
			if (res.ok) {
				setAssignedCourseIds(nextIds);
				toast.success(`Course ${isAssigned ? "unassigned" : "assigned"} successfully`);
				router.refresh();
			} else {
				toast.error("Failed to update course assignment");
			}
		} catch {
			toast.error("Failed to update course assignment");
		}
	}

	return (
		<ResizableDrawer open={open} onOpenChange={onOpenChange}>
			<ConfirmModal
				open={deleteOpen}
				title="Delete Class?"
				description="Are you sure you want to delete this class? All student assignments to this class will be cleared. This action cannot be undone."
				confirmText="Delete Class"
				isDestructive
				isLoading={isDeleting}
				onConfirm={handleDelete}
				onCancel={() => setDeleteOpen(false)}
			/>

			<div className="shrink-0 px-6 pt-1 pb-4 bg-slate-50/50 border-b border-slate-100 text-left">
				<div className="mx-auto w-full max-w-3xl flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] text-[#002388] shrink-0">
						<FolderKanban size={22} />
					</div>
					<div className="text-left min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-lg font-bold text-slate-900 truncate">
								{cls.name}
							</h2>
							<span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border bg-white text-slate-600 border-border shrink-0">
								Level {cls.level}
							</span>
							{cls.isGraduated && (
								<span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border bg-slate-100 text-slate-500 border-border shrink-0">
									Graduated
								</span>
							)}
						</div>
						<div className="flex items-center gap-4 mt-1 text-[12px] text-muted-foreground">
							<span>
								<span className="font-semibold text-slate-700">{cls._count.students}</span> student
								{cls._count.students === 1 ? "" : "s"}
							</span>
							<span>
								<span className="font-semibold text-slate-700">{cls._count.courses}</span> course
								{cls._count.courses === 1 ? "" : "s"}
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
									{key === "members" && (
										<span
											className={`flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
												active
													? "bg-[#002388] text-white"
													: "border border-border text-slate-500 bg-slate-50"
											}`}
										>
											{cls._count.students}
										</span>
									)}
									{key === "courses" && (
										<span
											className={`flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
												active
													? "bg-[#002388] text-white"
													: "border border-border text-slate-500 bg-slate-50"
											}`}
										>
											{cls._count.courses}
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
						<div className="space-y-6">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="name" className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
										Class Name
									</Label>
									<Input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="level" className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
										Level
									</Label>
									<div className="relative group">
										<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
											<Hash size={18} />
										</div>
										<Input
											id="level"
											type="number"
											value={level}
											onChange={(e) => setLevel(e.target.value)}
											className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
										/>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between pt-4 border-t border-slate-100">
								<Button
									type="button"
									variant="outline"
									onClick={() => setDeleteOpen(true)}
									className="h-10 gap-1.5 px-4 rounded-sm border-rose-200 text-rose-600 text-[12px] font-semibold hover:bg-rose-50"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete Class
								</Button>
								<Button
									type="button"
									onClick={handleSaveOverview}
									disabled={isSaving}
									className="h-10 gap-1.5 px-5 bg-[#002388] hover:bg-[#001570] text-white rounded-sm font-semibold text-[12px]"
								>
									{isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
									{isSaving ? "Saving..." : "Save Changes"}
								</Button>
							</div>
						</div>
					)}

					{activeTab === "members" && (
						<div className="space-y-4">
							<div className="flex items-center justify-between gap-3">
								<div className="relative flex-1 max-w-sm group">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#002388]" />
									<Input
										value={memberSearch}
										onChange={(e) => setMemberSearch(e.target.value)}
										placeholder="Search members by name, email, or program..."
										className="pl-9 pr-9 h-10 rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary text-[12px]"
									/>
									{memberSearch ? (
										<button
											type="button"
											onClick={() => setMemberSearch("")}
											className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
											aria-label="Clear search"
										>
											<X size={13} />
										</button>
									) : null}
								</div>
								<Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] shrink-0">
									{members.length} total
								</Badge>
							</div>

							{membersLoading ? (
								<div className="flex justify-center items-center h-32">
									<Loader2 className="h-6 w-6 animate-spin text-[#002388]" />
								</div>
							) : members.length === 0 ? (
								<p className="text-sm text-slate-500 text-center py-8">No students in this class.</p>
							) : filteredMembers.length === 0 ? (
								<p className="text-sm text-slate-500 text-center py-8">No matches for "{memberSearch}".</p>
							) : (
								<div className="grid gap-2 max-h-[420px] overflow-y-auto pr-0.5">
									{filteredMembers.map((m) => (
										<div
											key={m.id}
											className="p-3 rounded-sm border border-slate-100 bg-slate-50 flex items-start justify-between"
										>
											<div className="space-y-1">
												<p className="font-semibold text-slate-800 text-sm">{m.name || "—"}</p>
												<p className="text-xs text-slate-500">{m.email}</p>
											</div>
											<Badge variant={m.status === "ACTIVE" ? "success" : "warning"} className="text-[10px]">
												{m.status}
											</Badge>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{activeTab === "courses" && (
						<>
							{coursesLoading && assignedCourseIds.size === 0 ? (
								<div className="flex justify-center items-center h-32">
									<Loader2 className="h-6 w-6 animate-spin text-[#002388]" />
								</div>
							) : (
								<AssignmentChecklist
									items={allCourses.map((c) => ({
										id: c.id,
										label: `${c.code} — ${c.title}`,
										sublabel: `${c.credits} credits`,
									}))}
									assignedIds={assignedCourseIds}
									onToggle={handleToggleCourse}
									searchPlaceholder="Search courses by code or title..."
									emptyMessage="No courses found in the system."
								/>
							)}
						</>
					)}
				</div>
			</div>
		</ResizableDrawer>
	);
}
