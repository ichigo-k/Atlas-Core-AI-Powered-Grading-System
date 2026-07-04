"use client";

import { useEffect, useState } from "react";
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

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import ClassDetailSheet from "./ClassDetailSheet";

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
	const [selected, setSelected] = useState<ClassWithDetails[]>([]);
	const [isUpgrading, setIsUpgrading] = useState(false);

	const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
	const [deleteTargets, setDeleteTargets] = useState<ClassWithDetails[] | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [detailClass, setDetailClass] = useState<ClassWithDetails | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailTab, setDetailTab] = useState<"overview" | "members" | "courses">("overview");

	const singleSelected = selected.length === 1 ? selected[0] : null;

	const handleOpenDetail = (cls: ClassWithDetails, tab: "overview" | "members" | "courses" = "overview") => {
		setDetailClass(cls);
		setDetailTab(tab);
		setDetailOpen(true);
	};

	// Keep the local table copy (and any open drawer) in sync with fresh server data.
	useEffect(() => {
		setClasses(initialClasses);
	}, [initialClasses]);

	useEffect(() => {
		if (!detailClass) return;
		const fresh = classes.find((c) => c.id === detailClass.id);
		if (fresh && fresh !== detailClass) setDetailClass(fresh);
	}, [classes, detailClass]);

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

	const rowActions: RowAction[] = [
		{
			label: "Open",
			icon: Edit2,
			disabled: !singleSelected,
			onClick: () => singleSelected && handleOpenDetail(singleSelected),
		},
		{
			label: "Members",
			icon: UserPlus,
			disabled: !singleSelected,
			onClick: () => singleSelected && handleOpenDetail(singleSelected, "members"),
		},
		{
			label: "Courses",
			icon: Settings2,
			disabled: !singleSelected,
			onClick: () => singleSelected && handleOpenDetail(singleSelected, "courses"),
		},
		{
			label: "Delete",
			icon: Trash2,
			destructive: true,
			separatorBefore: true,
			onClick: () => setDeleteTargets(selected),
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
					onClick={() => setAddEditOpen(true)}
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
				onRowClick={(cls) => handleOpenDetail(cls)}
				toolbarActions={selected.length > 0 ? <RowActionsMenu actions={rowActions} /> : null}
			/>

			<AddEditClassSheet
				open={addEditOpen}
				onOpenChange={setAddEditOpen}
			/>

			<ClassDetailSheet
				cls={detailClass}
				open={detailOpen}
				onOpenChange={setDetailOpen}
				initialTab={detailTab}
				allCourses={courses}
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
