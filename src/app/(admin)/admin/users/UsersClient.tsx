"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	Edit2,
	GraduationCap,
	History,
	MoreVertical,
	ShieldCheck,
	Trash2,
	Upload,
	UserCheck,
	UserPlus,
	Users as UsersIcon,
	UserX,
} from "lucide-react";
import Link from "next/link";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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
type AdminSelectOption = {
	id: number;
	name: string;
	code?: string | null;
	level?: number | null;
};

function emailLocalPart(email: string): string {
	return email.split("@")[0];
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

interface ActionButtonsProps {
	user: UserWithProfile;
	onEdit: (user: UserWithProfile) => void;
	onDelete: (user: UserWithProfile) => void;
}

function ActionButtons({ user, onEdit, onDelete }: ActionButtonsProps) {
	const [loading, setLoading] = useState(false);

	async function handleToggleStatus() {
		setLoading(true);
		const result = await toggleUserStatusAction(user.id, user.status);
		if (result.success) {
			toast.success(
				`User ${user.status === "ACTIVE" ? "suspended" : "activated"} successfully`,
			);
		} else {
			toast.error(result.error || "Failed to update status");
		}
		setLoading(false);
	}

	return (
		<div className="text-right">
			<TooltipProvider>
				<div className="flex items-center justify-end gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => onEdit(user)}
								className="p-2 text-slate-400 hover:text-[#002388] hover:bg-[#002388]/5 rounded-sm transition-all"
							>
								<Edit2 size={16} />
							</button>
						</TooltipTrigger>
						<TooltipContent>Edit Profile & Class</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								disabled={loading}
								onClick={handleToggleStatus}
								className={`p-2 rounded-sm transition-all ${user.status === "SUSPENDED"
									? "text-emerald-500 hover:bg-emerald-50"
									: "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
									}`}
							>
								{user.status === "SUSPENDED" ? (
									<UserCheck size={16} />
								) : (
									<UserX size={16} />
								)}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							{user.status === "SUSPENDED" ? "Unsuspend User" : "Suspend User"}
						</TooltipContent>
					</Tooltip>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all"
							>
								<MoreVertical size={16} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={() => onEdit(user)}>
								<Edit2 className="mr-2 h-4 w-4" />
								Edit Details
							</DropdownMenuItem>
							{user.role === "STUDENT" && (
								<DropdownMenuItem asChild>
									<Link href={`/admin/student-history/${user.id}`}>
										<History className="mr-2 h-4 w-4" />
										View Records
									</Link>
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
								onClick={() => onDelete(user)}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete Account
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TooltipProvider>
		</div>
	);
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
	const [activeTab, setActiveTab] = useState<UserRole>("STUDENT");
	const [addUserOpen, setAddUserOpen] = useState(false);
	const [bulkImportOpen, setBulkImportOpen] = useState(false);
	const [editUser, setEditUser] = useState<UserWithProfile | null>(null);
	const [deleteUser, setDeleteUser] = useState<UserWithProfile | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const executeDelete = async () => {
		if (!deleteUser) return;
		setIsDeleting(true);
		const result = await deleteUserAction(deleteUser.id);
		if (result.success) {
			toast.success("User deleted successfully");
			setDeleteUser(null);
		} else {
			toast.error(result.error || "Failed to delete user");
		}
		setIsDeleting(false);
	};

	const counts = useMemo(
		() => ({
			STUDENT: users.filter((u: any) => u.role === "STUDENT").length,
			LECTURER: users.filter((u: any) => u.role === "LECTURER").length,
			ADMIN: users.filter((u: any) => u.role === "ADMIN").length,
		}),
		[users],
	);

	const filteredData = useMemo(
		() => users.filter((u: any) => u.role === activeTab),
		[users, activeTab],
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
							{row.original.name ?? "—"}
						</p>
						<p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
							{emailLocalPart(row.original.email)}
						</p>
					</div>
				),
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

		baseColumns.push(
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<ActionButtons
						user={row.original}
						onEdit={setEditUser}
						onDelete={setDeleteUser}
					/>
				),
			},
		);

		return baseColumns;
	}, [activeTab]);

	return (
		<div className="flex flex-col gap-6">
			{/* Action buttons */}
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
			/>

			<ConfirmModal
				open={!!deleteUser}
				title="Delete Account?"
				description={`Are you sure you want to delete ${deleteUser?.name || deleteUser?.email}? This will permanently remove their profile and all associated data. This action cannot be undone.`}
				confirmText="Delete Account"
				isDestructive={true}
				isLoading={isDeleting}
				onConfirm={executeDelete}
				onCancel={() => setDeleteUser(null)}
			/>

			{/* Tabs */}
			<div className="flex items-center gap-8 border-b border-border">
				{tabs.map(({ key, label, icon: Icon }) => {
					const active = activeTab === key;
					return (
						<button
							type="button"
							key={key}
							onClick={() => setActiveTab(key)}
							className={`group relative flex items-center gap-2.5 pb-4 text-sm transition-colors ${active
								? "text-[#002388] font-semibold"
								: "text-slate-500 font-medium hover:text-slate-700"
								}`}
						>
							<Icon size={16} strokeWidth={active ? 2.5 : 2} />
							{label}
							<span
								className={`flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${active
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

			<DataTable
				columns={columns}
				data={filteredData}
				searchKey="name"
				placeholder={`Search ${activeTab.toLowerCase()}s...`}
			/>
		</div>
	);
}
