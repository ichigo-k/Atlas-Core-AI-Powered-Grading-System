"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
	FolderPlus,
	Settings2,
	UserPlus,
	ArrowUpDown,
	Trash2,
	Edit2,
	ArrowUpCircle,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import type { ClassWithDetails, CourseSimple } from "@/lib/admin-classes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import AddEditClassSheet from "./AddEditClassSheet";
import ManageCoursesSheet from "./ManageCoursesSheet";
import ClassMembersSheet from "./ClassMembersSheet";

import { ConfirmModal } from "@/components/ui/confirm-modal";

export default function ClassesClient({
	initialClasses,
	courses,
}: {
	initialClasses: ClassWithDetails[];
	courses: CourseSimple[];
}) {
	const router = useRouter();
	const [classes, setClasses] = useState<ClassWithDetails[]>(initialClasses);
	const [addEditOpen, setAddEditOpen] = useState(false);
	const [editingClass, setEditingClass] = useState<ClassWithDetails | null>(null);
	const [coursesOpen, setCoursesOpen] = useState(false);
	const [membersOpen, setMembersOpen] = useState(false);
	const [selected, setSelected] = useState<ClassWithDetails[]>([]);
	const [isUpgrading, setIsUpgrading] = useState(false);

	const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
	const [deleteTargets, setDeleteTargets] = useState<ClassWithDetails[] | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const singleSelected = selected.length === 1 ? selected[0] : null;

	const handleEdit = (cls: ClassWithDetails) => {
		setEditingClass(cls);
		setAddEditOpen(true);
	};

	const executeBulkUpgrade = async () => {
		setIsUpgrading(true);
		try {
			const res = await fetch("/api/admin/classes/upgrade", { method: "POST" });
			if (res.ok) {
				toast.success("Classes upgraded successfully!");
				router.refresh();
				setUpgradeConfirmOpen(false);
			} else {
				toast.error("Failed to upgrade classes.");
			}
		} catch {
			toast.error("An error occurred.");
		} finally {
			setIsUpgrading(false);
		}
	};

	const executeDelete = async () => {
		if (!deleteTargets || deleteTargets.length === 0) return;
		setIsDeleting(true);
		const failureMessages: string[] = [];
		for (const target of deleteTargets) {
			try {
				const res = await fetch(`/api/admin/classes/${target.id}`, { method: "DELETE" });
				if (res.ok) {
					setClasses(prev => prev.filter(c => c.id !== target.id));
				} else {
					const data = await res.json().catch(() => null);
					failureMessages.push(data?.error || `Failed to delete ${target.name}`);
				}
			} catch {
				failureMessages.push(`Failed to delete ${target.name}`);
			}
		}
		if (failureMessages.length === 0) {
			toast.success(deleteTargets.length === 1 ? "Class deleted successfully." : `${deleteTargets.length} classes deleted successfully.`);
		} else if (failureMessages.length === 1) {
			toast.error(failureMessages[0]);
		} else {
			toast.error(`${failureMessages.length} of ${deleteTargets.length} deletions failed: ${failureMessages.join(" ")}`);
		}
		setDeleteTargets(null);
		setSelected([]);
		setIsDeleting(false);
	};

	const columns: ColumnDef<ClassWithDetails>[] = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="-ml-4 h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-transparent"
				>
					Class Name
					<ArrowUpDown className="ml-2 h-3 w-3" />
				</Button>
			),
			cell: ({ row }) => {
				const cls = row.original;
				return (
					<div className="flex flex-col">
						<span className="font-semibold text-slate-900 group-hover:text-[#002388] transition-colors">
							{cls.name}
						</span>
						<span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
							Level {cls.level}
						</span>
					</div>
				);
			},
		},
		{
			id: "students",
			header: "Students",
			cell: ({ row }) => (
				<span className="text-xs font-semibold text-slate-600">{row.original._count.students}</span>
			),
		},
		{
			id: "courses",
			header: "Courses",
			cell: ({ row }) => (
				<span className="text-xs font-semibold text-slate-600">{row.original._count.courses}</span>
			),
		},
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => {
				const cls = row.original;
				if (cls.isGraduated) {
					return <Badge variant="secondary">Graduated</Badge>;
				}
				const hasCourses = cls._count.courses > 0;
				return (
					<Badge variant={hasCourses ? "success" : "warning"}>
						{hasCourses ? "Ready" : "Setup Required"}
					</Badge>
				);
			},
		},
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-end gap-3">
				<button
					onClick={() => setUpgradeConfirmOpen(true)}
					disabled={isUpgrading}
					className="flex items-center gap-2 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
				>
					<ArrowUpCircle size={18} className="text-slate-400" />
					Bulk Upgrade Levels
				</button>
				<button
					onClick={() => { setEditingClass(null); setAddEditOpen(true); }}
					className="flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#001570]"
				>
					<FolderPlus size={18} />
					Create Class
				</button>
			</div>

			{/*
				Azure/AWS-style command bar: Edit/Members/Courses/Delete live as
				dedicated buttons that enable based on selection instead of a
				per-row kebab menu. Click a row to open it directly.
			*/}
			<DataTable
				columns={columns}
				data={classes}
				searchKey="name"
				placeholder="Search classes by name..."
				enableSelection
				getRowId={(cls) => cls.id}
				onSelectionChange={setSelected}
				onRowClick={(cls) => handleEdit(cls)}
				toolbarActions={
					selected.length > 0 ? (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={!singleSelected}
								onClick={() => singleSelected && handleEdit(singleSelected)}
								className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40"
							>
								<Edit2 className="h-3.5 w-3.5" />
								Edit
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!singleSelected}
								onClick={() => setMembersOpen(true)}
								className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40"
							>
								<UserPlus className="h-3.5 w-3.5" />
								Members
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!singleSelected}
								onClick={() => setCoursesOpen(true)}
								className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40"
							>
								<Settings2 className="h-3.5 w-3.5" />
								Courses
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setDeleteTargets(selected)}
								className="h-9 gap-1.5 px-3.5 rounded-sm border-rose-200 text-rose-600 text-[11px] font-semibold uppercase tracking-wider hover:bg-rose-50"
							>
								<Trash2 className="h-3.5 w-3.5" />
								Delete
							</Button>
						</>
					) : null
				}
			/>

			<AddEditClassSheet
				open={addEditOpen}
				onOpenChange={setAddEditOpen}
				editingClass={editingClass}
			/>

			<ManageCoursesSheet
				open={coursesOpen}
				onOpenChange={setCoursesOpen}
				cls={singleSelected}
				allCourses={courses}
			/>

			<ClassMembersSheet
				open={membersOpen}
				onOpenChange={setMembersOpen}
				cls={singleSelected}
			/>

			<ConfirmModal
				open={upgradeConfirmOpen}
				title="Upgrade All Classes?"
				description="Are you sure you want to upgrade all non-graduated classes by 1 level (e.g. 100 -> 200)? Classes reaching 400 will automatically be marked as graduated."
				confirmText="Yes, upgrade classes"
				isLoading={isUpgrading}
				onConfirm={executeBulkUpgrade}
				onCancel={() => setUpgradeConfirmOpen(false)}
			/>

			<ConfirmModal
				open={!!deleteTargets}
				title={deleteTargets && deleteTargets.length > 1 ? `Delete ${deleteTargets.length} classes?` : "Delete Class?"}
				description={
					deleteTargets && deleteTargets.length > 1
						? `Are you sure you want to delete these ${deleteTargets.length} classes? All student assignments will be cleared. This action cannot be undone.`
						: "Are you sure you want to delete this class? All student assignments to this class will be cleared. This action cannot be undone."
				}
				confirmText="Delete class"
				isDestructive={true}
				isLoading={isDeleting}
				onConfirm={executeDelete}
				onCancel={() => setDeleteTargets(null)}
			/>
		</div>
	);
}
