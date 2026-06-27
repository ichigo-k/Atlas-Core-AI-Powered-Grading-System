"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
	FolderPlus,
	Settings2,
	UserPlus,
	ArrowUpDown,
	MoreVertical,
	Trash2,
	Edit2,
	ArrowUpCircle,
	Loader2
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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
	const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(null);
	const [isUpgrading, setIsUpgrading] = useState(false);
	
	const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

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
		if (deleteConfirmId === null) return;
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/admin/classes/${deleteConfirmId}`, { method: "DELETE" });
			if (res.ok) {
				setClasses(prev => prev.filter(c => c.id !== deleteConfirmId));
				toast.success("Class deleted successfully.");
				setDeleteConfirmId(null);
			} else {
				toast.error("Failed to delete class.");
			}
		} catch {
			toast.error("An error occurred.");
		} finally {
			setIsDeleting(false);
		}
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
		{
			id: "actions",
			cell: ({ row }) => {
				const cls = row.original;
				return (
					<div className="text-right">
						<TooltipProvider>
							<div className="flex items-center justify-end gap-1">
								<Tooltip>
									<TooltipTrigger asChild>
										<button 
											onClick={() => { setSelectedClass(cls); setMembersOpen(true); }}
											className="p-2 text-slate-400 hover:text-[#002388] hover:bg-[#002388]/5 rounded-sm transition-all"
										>
											<UserPlus size={16} />
										</button>
									</TooltipTrigger>
									<TooltipContent>View Members</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<button 
											onClick={() => { setSelectedClass(cls); setCoursesOpen(true); }}
											className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all"
										>
											<Settings2 size={16} />
										</button>
									</TooltipTrigger>
									<TooltipContent>Manage Courses</TooltipContent>
								</Tooltip>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all">
											<MoreVertical size={16} />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => { setEditingClass(cls); setAddEditOpen(true); }}>
											<Edit2 className="mr-2 h-4 w-4" /> Edit
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem onClick={() => setDeleteConfirmId(cls.id)} className="text-red-600">
											<Trash2 className="mr-2 h-4 w-4" /> Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</TooltipProvider>
					</div>
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

			<DataTable
				columns={columns}
				data={classes}
				searchKey="name"
				placeholder="Search classes by name..."
			/>

			<AddEditClassSheet
				open={addEditOpen}
				onOpenChange={setAddEditOpen}
				editingClass={editingClass}
			/>

			<ManageCoursesSheet
				open={coursesOpen}
				onOpenChange={setCoursesOpen}
				cls={selectedClass}
				allCourses={courses}
			/>

			<ClassMembersSheet
				open={membersOpen}
				onOpenChange={setMembersOpen}
				cls={selectedClass}
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
				open={deleteConfirmId !== null}
				title="Delete Class?"
				description="Are you sure you want to delete this class? All student assignments to this class will be cleared. This action cannot be undone."
				confirmText="Delete class"
				isDestructive={true}
				isLoading={isDeleting}
				onConfirm={executeDelete}
				onCancel={() => setDeleteConfirmId(null)}
			/>
		</div>
	);
}
