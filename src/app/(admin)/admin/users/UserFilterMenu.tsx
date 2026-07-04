"use client";

import { Filter, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type UserRole = "STUDENT" | "LECTURER" | "ADMIN";
type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "PENDING";
export type FieldKey = "status" | "program" | "class" | "department";

const FIELD_LABELS: Record<FieldKey, string> = {
	status: "Status",
	program: "Program",
	class: "Class",
	department: "Department",
};

const FIELDS_BY_TAB: Record<UserRole, FieldKey[]> = {
	STUDENT: ["program", "class"],
	LECTURER: ["department"],
	ADMIN: [],
};

interface UserFilterMenuProps {
	activeTab: UserRole;
	statusFilter: StatusFilter;
	setStatusFilter: (v: StatusFilter) => void;
	statusFilters: { key: StatusFilter; label: string }[];
	statusCounts: Record<StatusFilter, number>;
	programFilter: number | "ALL";
	setProgramFilter: (v: number | "ALL") => void;
	programs: { id: number; name: string }[];
	classFilter: number | "ALL";
	setClassFilter: (v: number | "ALL") => void;
	classes: { id: number; name: string; level?: number | null }[];
	departmentFilter: string | "ALL";
	setDepartmentFilter: (v: string | "ALL") => void;
	departmentOptions: string[];
	onFilterChange: () => void;
	visibleExtra: FieldKey[];
	setVisibleExtra: (updater: (prev: FieldKey[]) => FieldKey[]) => void;
}

export default function UserFilterMenu({
	activeTab,
	statusFilter,
	setStatusFilter,
	statusFilters,
	statusCounts,
	programFilter,
	setProgramFilter,
	programs,
	classFilter,
	setClassFilter,
	classes,
	departmentFilter,
	setDepartmentFilter,
	departmentOptions,
	onFilterChange,
	visibleExtra,
	setVisibleExtra,
}: UserFilterMenuProps) {
	const availableExtraFields = FIELDS_BY_TAB[activeTab];

	const fieldValue: Record<FieldKey, string> = {
		status: statusFilter,
		program: programFilter === "ALL" ? "ALL" : String(programFilter),
		class: classFilter === "ALL" ? "ALL" : String(classFilter),
		department: departmentFilter,
	};

	const activeFilterCount =
		(statusFilter !== "ALL" ? 1 : 0) +
		(programFilter !== "ALL" ? 1 : 0) +
		(classFilter !== "ALL" ? 1 : 0) +
		(departmentFilter !== "ALL" ? 1 : 0);

	function removeExtra(field: FieldKey) {
		setVisibleExtra((prev) => prev.filter((f) => f !== field));
		if (field === "program") setProgramFilter("ALL");
		if (field === "class") setClassFilter("ALL");
		if (field === "department") setDepartmentFilter("ALL");
		onFilterChange();
	}

	function clearAll() {
		setStatusFilter("ALL");
		setProgramFilter("ALL");
		setClassFilter("ALL");
		setDepartmentFilter("ALL");
		setVisibleExtra(() => []);
		onFilterChange();
	}

	const hiddenFields = availableExtraFields.filter((f) => !visibleExtra.includes(f));

	function renderValueSelect(field: FieldKey) {
		if (field === "status") {
			return (
				<Select
					value={statusFilter}
					onValueChange={(v) => {
						setStatusFilter(v as StatusFilter);
						onFilterChange();
					}}
				>
					<SelectTrigger size="sm" className="flex-1 h-7 text-xs border-none shadow-none bg-transparent focus-visible:ring-0 px-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="start">
						{statusFilters.map((f) => (
							<SelectItem key={f.key} value={f.key} className="text-xs">
								{f.label}
								<span className="ml-auto text-[10px] text-slate-400">{statusCounts[f.key]}</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		if (field === "program") {
			return (
				<Select
					value={fieldValue.program}
					onValueChange={(v) => {
						setProgramFilter(v === "ALL" ? "ALL" : Number(v));
						onFilterChange();
					}}
				>
					<SelectTrigger size="sm" className="flex-1 h-7 text-xs border-none shadow-none bg-transparent focus-visible:ring-0 px-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="start">
						<SelectItem value="ALL" className="text-xs">All programs</SelectItem>
						{programs.map((p) => (
							<SelectItem key={p.id} value={String(p.id)} className="text-xs">
								{p.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		if (field === "class") {
			return (
				<Select
					value={fieldValue.class}
					onValueChange={(v) => {
						setClassFilter(v === "ALL" ? "ALL" : Number(v));
						onFilterChange();
					}}
				>
					<SelectTrigger size="sm" className="flex-1 h-7 text-xs border-none shadow-none bg-transparent focus-visible:ring-0 px-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="start">
						<SelectItem value="ALL" className="text-xs">All classes</SelectItem>
						{classes.map((c) => (
							<SelectItem key={c.id} value={String(c.id)} className="text-xs">
								{c.name} {c.level ? `(L${c.level})` : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		return (
			<Select
				value={departmentFilter}
				onValueChange={(v) => {
					setDepartmentFilter(v);
					onFilterChange();
				}}
			>
				<SelectTrigger size="sm" className="flex-1 h-7 text-xs border-none shadow-none bg-transparent focus-visible:ring-0 px-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="start">
					<SelectItem value="ALL" className="text-xs">All departments</SelectItem>
					{departmentOptions.map((d) => (
						<SelectItem key={d} value={d} className="text-xs">
							{d}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	const rows: FieldKey[] = ["status", ...visibleExtra];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
				>
					<Filter className="h-3.5 w-3.5" />
					Filter
					{activeFilterCount > 0 && (
						<span className="flex items-center justify-center rounded-full bg-[#002388] text-white h-4 min-w-4 px-1 text-[10px] font-bold">
							{activeFilterCount}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				onCloseAutoFocus={(e) => e.preventDefault()}
				className="w-[420px] rounded-lg p-4 space-y-3"
			>
				<div className="flex items-center justify-between">
					<span className="text-[13px] font-semibold text-slate-700">Filters</span>
					{activeFilterCount > 0 && (
						<button
							type="button"
							onClick={clearAll}
							className="flex items-center gap-1 text-[11px] font-semibold text-[#002388] hover:underline"
						>
							<X className="h-3 w-3" />
							Clear all
						</button>
					)}
				</div>

				<div className="space-y-2">
					{rows.map((field, i) => (
						<div key={field} className="flex items-center gap-2">
							<span className="w-10 shrink-0 text-[11px] text-slate-400">
								{i === 0 ? "Where" : "And"}
							</span>
							<div className="flex flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/60 pl-2.5 pr-1 py-0.5 min-w-0">
								<span className="w-20 shrink-0 text-xs font-semibold text-slate-600">
									{FIELD_LABELS[field]}
								</span>
								<span className="shrink-0 text-xs text-slate-400">is</span>
								{renderValueSelect(field)}
							</div>
							{field !== "status" ? (
								<button
									type="button"
									onClick={() => removeExtra(field)}
									className="shrink-0 flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
									aria-label={`Remove ${FIELD_LABELS[field]} filter`}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							) : (
								<span className="w-7 shrink-0" />
							)}
						</div>
					))}
				</div>

				{hiddenFields.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex items-center gap-1.5 text-[12px] font-semibold text-[#002388] hover:underline"
							>
								<Plus className="h-3.5 w-3.5" />
								Add condition
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-44 rounded-md p-1">
							{hiddenFields.map((field) => (
								<DropdownMenuItem
									key={field}
									onClick={() => setVisibleExtra((prev) => [...prev, field])}
									className="rounded-sm px-2.5 py-1.5 text-xs font-medium"
								>
									{FIELD_LABELS[field]}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
