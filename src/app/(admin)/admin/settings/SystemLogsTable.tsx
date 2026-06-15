"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { clearAuditLogsAction } from "@/app/actions/admin-settings-server";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";

export interface AuditLogRow {
	id: number;
	action: string;
	details: string;
	category: string;
	createdAt: Date;
}

function getAuditColor(category: string) {
	switch (category) {
		case "USER":
			return "bg-blue-50 text-blue-700";
		case "CLASS":
			return "bg-purple-50 text-purple-700";
		case "COURSE":
			return "bg-amber-50 text-amber-700";
		case "FACULTY":
			return "bg-cyan-50 text-cyan-700";
		case "PROGRAM":
			return "bg-indigo-50 text-indigo-700";
		case "SYSTEM":
			return "bg-rose-50 text-rose-700";
		default:
			return "bg-slate-50 text-slate-700";
	}
}

export default function SystemLogsTable({
	initialLogs,
}: {
	initialLogs: AuditLogRow[];
}) {
	const [categoryFilter, setCategoryFilter] = useState("ALL");
	const [showClearModal, setShowClearModal] = useState(false);
	const [isClearing, setIsClearing] = useState(false);

	const handleClearLogs = async () => {
		setIsClearing(true);
		const result = await clearAuditLogsAction();
		if (result.success) {
			toast.success("Audit logs cleared successfully.");
			setShowClearModal(false);
		} else {
			toast.error(result.error || "Failed to clear logs.");
		}
		setIsClearing(false);
	};

	const filteredLogs = useMemo(() => {
		if (categoryFilter === "ALL") return initialLogs;
		return initialLogs.filter((log) => log.category === categoryFilter);
	}, [initialLogs, categoryFilter]);

	const columns = useMemo(() => {
		const cols: ColumnDef<AuditLogRow>[] = [
			{
				accessorKey: "category",
				header: "Category",
				cell: ({ row }) => (
					<div
						className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getAuditColor(row.original.category)}`}
					>
						{row.original.category}
					</div>
				),
			},
			{
				accessorKey: "action",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="-ml-4 h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-transparent"
					>
						Action
						<ArrowUpDown className="ml-2 h-3 w-3" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-[13px] font-bold text-slate-900 tracking-tight block mt-0.5 group-hover:text-[#002388] transition-colors">
						{row.original.action.replace(/_/g, " ")}
					</span>
				),
			},
			{
				accessorKey: "details",
				header: "Details",
				cell: ({ row }) => (
					<p className="text-[13px] font-medium text-slate-600 leading-relaxed mt-0.5">
						{row.original.details}
					</p>
				),
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<div className="text-right">
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(column.getIsSorted() === "asc")
							}
							className="h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-transparent"
						>
							Time
							<ArrowUpDown className="ml-2 h-3 w-3" />
						</Button>
					</div>
				),
				cell: ({ row }) => (
					<div className="text-right">
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums whitespace-nowrap block mt-1">
							{formatDistanceToNow(new Date(row.original.createdAt), {
								addSuffix: true,
							})}
						</span>
					</div>
				),
			},
		];
		return cols;
	}, []);

	const categories = [
		"ALL",
		"USER",
		"CLASS",
		"COURSE",
		"FACULTY",
		"PROGRAM",
		"SYSTEM",
	];

	return (
		<div className="space-y-6">
			{/* Category Filters and Actions */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 no-scrollbar w-full sm:w-auto">
					{categories.map((cat) => (
						<button
							type="button"
							key={cat}
							onClick={() => setCategoryFilter(cat)}
							className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
								categoryFilter === cat
									? "bg-slate-900 text-white"
									: "bg-white border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900"
							}`}
						>
							{cat}
						</button>
					))}
				</div>
				{initialLogs.length > 0 && (
					<Button
						variant="outline"
						onClick={() => setShowClearModal(true)}
						className="h-9 px-4 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-all font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 self-start sm:self-auto"
					>
						<Trash2 size={14} />
						Clear Logs
					</Button>
				)}
			</div>

			<DataTable
				columns={columns}
				data={filteredLogs}
				searchKey="details"
				placeholder="Search log details..."
			/>

			<ConfirmModal
				open={showClearModal}
				title="Clear Audit Logs?"
				description="Are you sure you want to permanently delete all system audit logs? This action cannot be undone and will remove all history of administrative actions."
				confirmText="Clear All Logs"
				isDestructive={true}
				isLoading={isClearing}
				onConfirm={handleClearLogs}
				onCancel={() => setShowClearModal(false)}
			/>
		</div>
	);
}
