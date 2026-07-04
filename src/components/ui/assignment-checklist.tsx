"use client";

import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type AssignmentChecklistItem = {
	id: number;
	label: string;
	sublabel?: string;
};

interface AssignmentChecklistProps {
	items: AssignmentChecklistItem[];
	assignedIds: Set<number>;
	onToggle: (id: number, isAssigned: boolean) => Promise<void>;
	searchPlaceholder?: string;
	emptyMessage?: string;
}

export function AssignmentChecklist({
	items,
	assignedIds,
	onToggle,
	searchPlaceholder = "Search...",
	emptyMessage = "No options available.",
}: AssignmentChecklistProps) {
	const [search, setSearch] = useState("");
	const [loadingId, setLoadingId] = useState<number | null>(null);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return items;
		return items.filter(
			(item) =>
				item.label.toLowerCase().includes(query) ||
				item.sublabel?.toLowerCase().includes(query),
		);
	}, [items, search]);

	async function handleToggle(id: number, isAssigned: boolean) {
		setLoadingId(id);
		try {
			await onToggle(id, isAssigned);
		} finally {
			setLoadingId(null);
		}
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div className="relative flex-1 max-w-sm group">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#002388]" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={searchPlaceholder}
						className="pl-9 pr-9 h-10 rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary text-[12px]"
					/>
					{search ? (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
							aria-label="Clear search"
						>
							<X size={13} />
						</button>
					) : null}
				</div>
				<Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] shrink-0">
					{assignedIds.size} assigned
				</Badge>
			</div>

			<div className="grid gap-2 max-h-[420px] overflow-y-auto pr-0.5">
				{items.length === 0 ? (
					<p className="text-sm text-slate-500 py-6 text-center">{emptyMessage}</p>
				) : filtered.length === 0 ? (
					<p className="text-sm text-slate-500 py-6 text-center">No matches for "{search}".</p>
				) : (
					filtered.map((item) => {
						const isAssigned = assignedIds.has(item.id);
						const loading = loadingId === item.id;
						return (
							<div
								key={item.id}
								className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
									isAssigned
										? "border-[#002388]/20 bg-[#002388]/5"
										: "border-slate-100 hover:border-border"
								}`}
							>
								<div className="flex items-center gap-3 min-w-0">
									<Checkbox
										id={`assign-${item.id}`}
										checked={isAssigned}
										onCheckedChange={() => handleToggle(item.id, isAssigned)}
										disabled={loadingId !== null}
									/>
									<label
										htmlFor={`assign-${item.id}`}
										className="text-sm font-semibold text-slate-700 cursor-pointer truncate"
									>
										{item.label}
										{item.sublabel ? (
											<span className="text-xs text-slate-400 font-medium ml-1.5">
												{item.sublabel}
											</span>
										) : null}
									</label>
								</div>
								{loading && (
									<Loader2 size={14} className="animate-spin text-[#002388] shrink-0" />
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
