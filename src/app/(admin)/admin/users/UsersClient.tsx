"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	BookOpen,
	Edit2,
	FolderKanban,
	GraduationCap,
	History,
	School,
	ShieldCheck,
	Trash2,
	Upload,
	UserCheck,
	UserPlus,
	Users as UsersIcon,
	UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	bulkAssignCourseToLecturersAction,
	bulkReassignClassAction,
	bulkReassignProgramAction,
	deleteUserAction,
	toggleUserStatusAction,
} from "@/app/actions/admin-users-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import type { UserWithProfile } from "@/lib/admin-users";
import AddUserSheet from "./AddUserSheet";
import BulkAssignDialog from "./BulkAssignDialog";
import BulkImportSheet from "./BulkImportSheet";
import EditUserSheet from "./EditUserSheet";
import UserFilterMenu, { type FieldKey } from "./UserFilterMenu";

const tabs = [
	{ key: "STUDENT" as const, label: "Students", icon: GraduationCap },
	{ key: "LECTURER" as const, label: "Lecturers", icon: UsersIcon },
	{ key: "ADMIN" as const, label: "Admins", icon: ShieldCheck },
];

type UserRole = (typeof tabs)[number]["key"];
type StatusFilter = "ALL" | UserWithProfile["status"];

const statusFilters: Array<{ key: StatusFilter; label: string }> = [
	{ key: "ALL", label: "All" },
	{ key: "ACTIVE", label: "Active" },
	{ key: "SUSPENDED", label: "Suspended" },
	{ key: "PENDING", label: "Pending" },
];
type AdminSelectOption = {
	id: number;
	name: string;
	code?: string | null;
	level?: number | null;
};
type CourseOption = { id: number; code: string; title: string };

function emailLocalPart(email: string): string {
	return email.split("@")[0];
}

function userIdentifier(user: UserWithProfile): string {
	return user.studentProfile?.indexNumber || emailLocalPart(user.email);
}

function StatusBadge({ status }: { status: UserWithProfile["status"] }) {
	const variant =
		status === "ACTIVE"
			? "success"
			: status === "SUSPENDED"
				? "danger"
				: "warning";
	const label =
		status === "ACTIVE"
			? "Active"
			: status === "SUSPENDED"
				? "Suspended"
				: "Pending";
	return <Badge variant={variant}>{label}</Badge>;
}

export default function UsersClient({
	users,
	classes = [],
	faculties = [],
	programs = [],
	courses = [],
}: {
	users: UserWithProfile[];
	classes?: AdminSelectOption[];
	faculties?: AdminSelectOption[];
	programs?: AdminSelectOption[];
	courses?: CourseOption[];
}) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<UserRole>("STUDENT");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [programFilter, setProgramFilter] = useState<number | "ALL">("ALL");
	const [classFilter, setClassFilter] = useState<number | "ALL">("ALL");
	const [departmentFilter, setDepartmentFilter] = useState<string | "ALL">("ALL");
	const [visibleExtraFilters, setVisibleExtraFilters] = useState<FieldKey[]>([]);
	const [addUserOpen, setAddUserOpen] = useState(false);
	const [bulkImportOpen, setBulkImportOpen] = useState(false);
	const [editUser, setEditUser] = useState<UserWithProfile | null>(null);
	const [selected, setSelected] = useState<UserWithProfile[]>([]);
	const [deleteTargets, setDeleteTargets] = useState<UserWithProfile[] | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isTogglingStatus, setIsTogglingStatus] = useState(false);
	const [bulkClassOpen, setBulkClassOpen] = useState(false);
	const [bulkProgramOpen, setBulkProgramOpen] = useState(false);
	const [bulkCourseOpen, setBulkCourseOpen] = useState(false);

	// Selection resets whenever the visible rows change (tab/status switch).
	const resetKey = `${activeTab}-${statusFilter}-${programFilter}-${classFilter}-${departmentFilter}`;

	const clearFacetFilters = () => {
		setStatusFilter("ALL");
		setProgramFilter("ALL");
		setClassFilter("ALL");
		setDepartmentFilter("ALL");
		setVisibleExtraFilters([]);
	};

	const singleSelected = selected.length === 1 ? selected[0] : null;

	const handleBulkClassAssign = async (classId: number | null) => {
		const result = await bulkReassignClassAction(
			selected.map((u) => u.id),
			classId,
		);
		if (result.success) {
			toast.success(`Class updated for ${selected.length} student${selected.length === 1 ? "" : "s"}`);
			setBulkClassOpen(false);
			setSelected([]);
		} else {
			toast.error(result.error || "Failed to reassign class");
		}
	};

	const handleBulkProgramAssign = async (programId: number | null) => {
		const result = await bulkReassignProgramAction(
			selected.map((u) => u.id),
			programId,
		);
		if (result.success) {
			toast.success(`Program updated for ${selected.length} student${selected.length === 1 ? "" : "s"}`);
			setBulkProgramOpen(false);
			setSelected([]);
		} else {
			toast.error(result.error || "Failed to reassign program");
		}
	};

	const handleBulkCourseAssign = async (courseId: number | null) => {
		if (!courseId) return;
		const result = await bulkAssignCourseToLecturersAction(
			selected.map((u) => u.id),
			courseId,
		);
		if (result.success) {
			toast.success(`Course assigned to ${selected.length} lecturer${selected.length === 1 ? "" : "s"}`);
			setBulkCourseOpen(false);
			setSelected([]);
		} else {
			toast.error(result.error || "Failed to assign course");
		}
	};

	const executeDelete = async () => {
		if (!deleteTargets || deleteTargets.length === 0) return;
		setIsDeleting(true);
		let failures = 0;
		for (const target of deleteTargets) {
			const result = await deleteUserAction(target.id);
			if (!result.success) failures++;
		}
		if (failures === 0) {
			toast.success(
				deleteTargets.length === 1
					? "User deleted successfully"
					: `${deleteTargets.length} users deleted successfully`,
			);
		} else {
			toast.error(`${failures} of ${deleteTargets.length} deletions failed`);
		}
		setDeleteTargets(null);
		setSelected([]);
		setIsDeleting(false);
	};

	const handleToggleStatus = async () => {
		if (!singleSelected) return;
		setIsTogglingStatus(true);
		const result = await toggleUserStatusAction(
			singleSelected.id,
			singleSelected.status,
		);
		if (result.success) {
			toast.success(
				`User ${singleSelected.status === "ACTIVE" ? "suspended" : "activated"} successfully`,
			);
			setSelected([]);
		} else {
			toast.error(result.error || "Failed to update status");
		}
		setIsTogglingStatus(false);
	};

	const counts = useMemo(
		() => ({
			STUDENT: users.filter((user) => user.role === "STUDENT").length,
			LECTURER: users.filter((user) => user.role === "LECTURER").length,
			ADMIN: users.filter((user) => user.role === "ADMIN").length,
		}),
		[users],
	);

	const usersForActiveRole = useMemo(
		() => users.filter((user) => user.role === activeTab),
		[users, activeTab],
	);

	const statusCounts = useMemo(
		() => ({
			ALL: usersForActiveRole.length,
			ACTIVE: usersForActiveRole.filter((user) => user.status === "ACTIVE")
				.length,
			SUSPENDED: usersForActiveRole.filter(
				(user) => user.status === "SUSPENDED",
			).length,
			PENDING: usersForActiveRole.filter((user) => user.status === "PENDING")
				.length,
		}),
		[usersForActiveRole],
	);

	const departmentOptions = useMemo(
		() =>
			Array.from(
				new Set(
					users
						.filter((u) => u.role === "LECTURER" && u.lecturerProfile?.department)
						.map((u) => u.lecturerProfile!.department as string),
				),
			).sort((a, b) => a.localeCompare(b)),
		[users],
	);

	const filteredData = useMemo(
		() =>
			usersForActiveRole.filter((user) => {
				if (statusFilter !== "ALL" && user.status !== statusFilter) return false;
				if (activeTab === "STUDENT") {
					if (programFilter !== "ALL" && user.studentProfile?.programId !== programFilter)
						return false;
					if (classFilter !== "ALL" && user.studentProfile?.classId !== classFilter)
						return false;
				}
				if (activeTab === "LECTURER") {
					if (
						departmentFilter !== "ALL" &&
						user.lecturerProfile?.department !== departmentFilter
					)
						return false;
				}
				return true;
			}),
		[usersForActiveRole, statusFilter, programFilter, classFilter, departmentFilter, activeTab],
	);

	const columns = useMemo(() => {
		const baseColumns: ColumnDef<UserWithProfile>[] = [
			{
				accessorKey: "name",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="-ml-4 h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-transparent"
					>
						User Name
						<ArrowUpDown className="ml-2 h-3 w-3" />
					</Button>
				),
				cell: ({ row }) => (
					<div className="min-w-0 group">
						<p className="truncate font-semibold text-slate-900 group-hover:text-[#002388] transition-colors">
							{row.original.name ?? "-"}
						</p>
						<p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
							{userIdentifier(row.original)}
						</p>
					</div>
				),
				filterFn: (row, _columnId, value) => {
					const query = String(value).toLowerCase();
					const user = row.original;
					return [
						user.name,
						user.email,
						emailLocalPart(user.email),
						user.studentProfile?.indexNumber,
						user.studentProfile?.program,
						user.lecturerProfile?.department,
						user.lecturerProfile?.title,
					]
						.filter(Boolean)
						.some((field) => String(field).toLowerCase().includes(query));
				},
			},
		];

		if (activeTab === "STUDENT") {
			baseColumns.push({
				id: "program",
				header: "Program",
				cell: ({ row }) => {
					const p = row.original.studentProfile;
					return p ? (
						<span className="text-xs font-medium text-slate-700">
							{p.program}
						</span>
					) : (
						<span className="text-xs text-slate-400">—</span>
					);
				},
			});
		} else if (activeTab === "LECTURER") {
			baseColumns.push({
				id: "deptTitle",
				header: "Department / Title",
				cell: ({ row }) => {
					const p = row.original.lecturerProfile;
					return p ? (
						<div>
							<p className="text-xs font-medium text-slate-700">
								{p.department}
							</p>
							<p className="text-[10px] text-slate-400 font-medium">
								{p.title}
							</p>
						</div>
					) : (
						<span className="text-xs text-slate-400">—</span>
					);
				},
			});
		} else {
			baseColumns.push({
				id: "dateJoined",
				header: "Date Joined",
				cell: ({ row }) => (
					<span className="text-xs font-medium text-slate-700">
						{new Date(
							row.original.dateJoined ?? row.original.createdAt,
						).toLocaleDateString()}
					</span>
				),
			});
		}

		baseColumns.push({
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => <StatusBadge status={row.original.status} />,
		});

		return baseColumns;
	}, [activeTab]);

	const rowActions: RowAction[] = [
		{
			label: "Edit",
			icon: Edit2,
			disabled: !singleSelected,
			onClick: () => singleSelected && setEditUser(singleSelected),
		},
		{
			label: singleSelected?.status === "SUSPENDED" ? "Unsuspend" : "Suspend",
			icon: singleSelected?.status === "SUSPENDED" ? UserCheck : UserX,
			disabled: !singleSelected || isTogglingStatus,
			onClick: handleToggleStatus,
		},
		...(singleSelected?.role === "STUDENT"
			? [
					{
						label: "Records",
						icon: History,
						onClick: () => router.push(`/admin/student-history/${singleSelected.id}`),
					},
				]
			: []),
		...(activeTab === "STUDENT"
			? [
					{ label: "Change Class", icon: FolderKanban, onClick: () => setBulkClassOpen(true) },
					{ label: "Change Program", icon: School, onClick: () => setBulkProgramOpen(true) },
				]
			: []),
		...(activeTab === "LECTURER"
			? [{ label: "Assign Course", icon: BookOpen, onClick: () => setBulkCourseOpen(true) }]
			: []),
		{
			label: "Delete",
			icon: Trash2,
			destructive: true,
			separatorBefore: true,
			onClick: () => setDeleteTargets(selected),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			{/* Page-level primary actions */}
			<div className="flex items-center justify-end gap-3">
				<button
					type="button"
					onClick={() => setBulkImportOpen(true)}
					className="flex items-center gap-2 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 transition-all hover:bg-slate-50"
				>
					<Upload size={18} className="text-slate-400" />
					Bulk Import
				</button>
				<button
					type="button"
					onClick={() => setAddUserOpen(true)}
					className="flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#001570]"
				>
					<UserPlus size={18} />
					Add User
				</button>
			</div>

			<AddUserSheet
				open={addUserOpen}
				onOpenChange={setAddUserOpen}
				classes={classes}
				faculties={faculties}
				programs={programs}
			/>
			<BulkImportSheet
				open={bulkImportOpen}
				onOpenChange={setBulkImportOpen}
				classes={classes}
			/>
			<EditUserSheet
				user={editUser}
				open={!!editUser}
				onOpenChange={(open) => !open && setEditUser(null)}
				classes={classes}
				programs={programs}
			/>

			<ConfirmModal
				open={!!deleteTargets}
				title={
					deleteTargets && deleteTargets.length > 1
						? `Delete ${deleteTargets.length} accounts?`
						: "Delete Account?"
				}
				description={
					deleteTargets && deleteTargets.length > 1
						? `Are you sure you want to delete these ${deleteTargets.length} accounts? This will permanently remove their profiles and all associated data. This action cannot be undone.`
						: `Are you sure you want to delete ${deleteTargets?.[0]?.name || deleteTargets?.[0]?.email}? This will permanently remove their profile and all associated data. This action cannot be undone.`
				}
				confirmText="Delete Account"
				isDestructive={true}
				isLoading={isDeleting}
				onConfirm={executeDelete}
				onCancel={() => setDeleteTargets(null)}
			/>

			{/* Tabs */}
			<div className="flex items-center gap-8 border-b border-border">
				{tabs.map(({ key, label, icon: Icon }) => {
					const active = activeTab === key;
					return (
						<button
							type="button"
							key={key}
							onClick={() => {
								setActiveTab(key);
								clearFacetFilters();
								setSelected([]);
							}}
							className={`group relative flex items-center gap-2.5 pb-4 text-sm transition-colors ${
								active
									? "text-[#002388] font-semibold"
									: "text-slate-500 font-medium hover:text-slate-700"
							}`}
						>
							<Icon size={16} strokeWidth={active ? 2.5 : 2} />
							{label}
							<span
								className={`flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${
									active
										? "bg-[#002388] text-white"
										: "border border-border text-slate-500 bg-slate-50 group-hover:border-slate-300"
								}`}
							>
								{counts[key]}
							</span>
							{active && (
								<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#002388] rounded-t-full" />
							)}
						</button>
					);
				})}
			</div>

			{/*
				Azure/AWS-style command bar: actions live as dedicated buttons that
				enable based on selection instead of a per-row kebab menu. Click a
				row to open it (Edit), tick checkboxes to act on one or many.
			*/}
			<DataTable
				key={resetKey}
				columns={columns}
				data={filteredData}
				searchKey="name"
				placeholder={`Search ${activeTab.toLowerCase()}s by name, email, or index number...`}
				enableSelection
				getRowId={(user) => user.id}
				onSelectionChange={setSelected}
				onRowClick={(user) => setEditUser(user)}
				toolbarActions={
					<>
						<UserFilterMenu
							key={activeTab}
							activeTab={activeTab}
							statusFilter={statusFilter}
							setStatusFilter={setStatusFilter}
							statusFilters={statusFilters}
							statusCounts={statusCounts}
							programFilter={programFilter}
							setProgramFilter={setProgramFilter}
							programs={programs}
							classFilter={classFilter}
							setClassFilter={setClassFilter}
							classes={classes}
							departmentFilter={departmentFilter}
							setDepartmentFilter={setDepartmentFilter}
							departmentOptions={departmentOptions}
							onFilterChange={() => setSelected([])}
						visibleExtra={visibleExtraFilters}
						setVisibleExtra={setVisibleExtraFilters}
						/>
						{selected.length > 0 && <RowActionsMenu actions={rowActions} />}
					</>
				}
			/>

			<BulkAssignDialog
				open={bulkClassOpen}
				onOpenChange={setBulkClassOpen}
				title={`Change class for ${selected.length} student${selected.length === 1 ? "" : "s"}`}
				description="Pick the class these students should be moved into. This replaces their current class assignment."
				searchUrl="/api/admin/classes/search"
				confirmLabel="Apply"
				allowUnassign
				onConfirm={handleBulkClassAssign}
			/>
			<BulkAssignDialog
				open={bulkProgramOpen}
				onOpenChange={setBulkProgramOpen}
				title={`Change program for ${selected.length} student${selected.length === 1 ? "" : "s"}`}
				description="Pick the academic program these students should be moved into. This replaces their current program."
				searchUrl="/api/admin/programs/search"
				confirmLabel="Apply"
				allowUnassign
				onConfirm={handleBulkProgramAssign}
			/>
			<BulkAssignDialog
				open={bulkCourseOpen}
				onOpenChange={setBulkCourseOpen}
				title={`Assign course to ${selected.length} lecturer${selected.length === 1 ? "" : "s"}`}
				description="Pick a course to add to these lecturers. This adds the course alongside whatever they already teach."
				searchUrl="/api/admin/courses/search"
				confirmLabel="Assign"
				onConfirm={handleBulkCourseAssign}
			/>
		</div>
	);
}
