"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	Edit2,
	GraduationCap,
	History,
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
	deleteUserAction,
	toggleUserStatusAction,
} from "@/app/actions/admin-users-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import type { UserWithProfile } from "@/lib/admin-users";
import AddUserSheet from "./AddUserSheet";
import BulkImportSheet from "./BulkImportSheet";
import EditUserSheet from "./EditUserSheet";

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
}: {
	users: UserWithProfile[];
	classes?: AdminSelectOption[];
	faculties?: AdminSelectOption[];
	programs?: AdminSelectOption[];
}) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<UserRole>("STUDENT");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [addUserOpen, setAddUserOpen] = useState(false);
	const [bulkImportOpen, setBulkImportOpen] = useState(false);
	const [editUser, setEditUser] = useState<UserWithProfile | null>(null);
	const [selected, setSelected] = useState<UserWithProfile[]>([]);
	const [deleteTargets, setDeleteTargets] = useState<UserWithProfile[] | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isTogglingStatus, setIsTogglingStatus] = useState(false);

	// Selection resets whenever the visible rows change (tab/status switch).
	const resetKey = `${activeTab}-${statusFilter}`;

	const singleSelected = selected.length === 1 ? selected[0] : null;

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

	const filteredData = useMemo(
		() =>
			usersForActiveRole.filter(
				(user) => statusFilter === "ALL" || user.status === statusFilter,
			),
		[usersForActiveRole, statusFilter],
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
								setStatusFilter("ALL");
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

			{/* Status facet filter — plain pills, not a hidden dropdown. */}
			<div className="flex items-center gap-2">
				{statusFilters.map((filter) => {
					const active = statusFilter === filter.key;
					return (
						<button
							type="button"
							key={filter.key}
							onClick={() => {
								setStatusFilter(filter.key);
								setSelected([]);
							}}
							className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
								active
									? "border-[#002388] bg-[#eef3ff] text-[#002388]"
									: "border-border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
							}`}
						>
							{filter.label}
							<span
								className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
									active ? "bg-[#002388] text-white" : "bg-slate-100 text-slate-500"
								}`}
							>
								{statusCounts[filter.key]}
							</span>
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
						<Button
							variant="outline"
							size="sm"
							disabled={!singleSelected}
							onClick={() => singleSelected && setEditUser(singleSelected)}
							className="h-10 gap-2 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
						>
							<Edit2 className="h-3.5 w-3.5" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!singleSelected || isTogglingStatus}
							onClick={handleToggleStatus}
							className="h-10 gap-2 rounded-sm border-border text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40"
						>
							{singleSelected?.status === "SUSPENDED" ? (
								<UserCheck className="h-3.5 w-3.5 text-emerald-600" />
							) : (
								<UserX className="h-3.5 w-3.5 text-rose-600" />
							)}
							{singleSelected?.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
						</Button>
						{singleSelected?.role === "STUDENT" && (
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									singleSelected &&
									router.push(`/admin/student-history/${singleSelected.id}`)
								}
								className="h-10 gap-2 rounded-sm border-border text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
							>
								<History className="h-3.5 w-3.5" />
								Records
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							disabled={selected.length === 0}
							onClick={() => setDeleteTargets(selected)}
							className="h-10 gap-2 rounded-sm border-rose-200 text-rose-600 text-[11px] font-semibold uppercase tracking-wider hover:bg-rose-50 disabled:opacity-40 disabled:border-border disabled:text-slate-400"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</Button>
					</>
				}
			/>
		</div>
	);
}
