"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BulkAssignOption {
	id: number;
	label: string;
}

interface BulkAssignDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	/** Static option list. Ignored when `searchUrl` is set. */
	options?: BulkAssignOption[];
	/**
	 * When set, options are fetched from `${searchUrl}?q=...` as the user
	 * types instead of filtering an in-memory list. Nothing loads until the
	 * user starts typing, so this stays fast with hundreds+ of rows.
	 */
	searchUrl?: string;
	confirmLabel: string;
	/** Include an "Unassigned" choice that resolves to null. */
	allowUnassign?: boolean;
	onConfirm: (selectedId: number | null) => Promise<void>;
}

const UNASSIGNED = "__unassigned__";

export default function BulkAssignDialog({
	open,
	onOpenChange,
	title,
	description,
	options,
	searchUrl,
	confirmLabel,
	allowUnassign = false,
	onConfirm,
}: BulkAssignDialogProps) {
	const [value, setValue] = useState<string>("");
	const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [searchResults, setSearchResults] = useState<BulkAssignOption[]>([]);
	const [searching, setSearching] = useState(false);

	useEffect(() => {
		if (!searchUrl || !open) return;
		const query = search.trim();
		if (!query) {
			setSearchResults([]);
			setSearching(false);
			return;
		}
		const controller = new AbortController();
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}`, {
					signal: controller.signal,
				});
				if (res.ok) {
					const data = await res.json();
					setSearchResults(data.results ?? data.classes ?? data.lecturers ?? []);
				}
			} catch (err) {
				if ((err as Error).name !== "AbortError") setSearchResults([]);
			} finally {
				setSearching(false);
			}
		}, 250);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [open, search, searchUrl]);

	const filteredOptions = useMemo(() => {
		if (searchUrl) return searchResults;
		const list = options ?? [];
		const query = search.trim().toLowerCase();
		if (!query) return list;
		return list.filter((o) => o.label.toLowerCase().includes(query));
	}, [options, search, searchUrl, searchResults]);

	const handleSelect = (opt: BulkAssignOption) => {
		setValue(String(opt.id));
		setSelectedLabel(opt.label);
	};

	const handleConfirm = async () => {
		if (!value) return;
		setLoading(true);
		try {
			await onConfirm(value === UNASSIGNED ? null : Number(value));
			setValue("");
			setSelectedLabel(null);
			setSearch("");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!loading) {
					onOpenChange(next);
					if (!next) {
						setValue("");
						setSelectedLabel(null);
						setSearch("");
					}
				}
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="relative group">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#002388]" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search options..."
							className="pl-9 pr-9 h-10 rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary text-[13px]"
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

					{(selectedLabel || value === UNASSIGNED) && (
						<p className="text-xs font-medium text-slate-500">
							Selected:{" "}
							<span className="text-[#002388] font-semibold">
								{value === UNASSIGNED ? "Unassigned" : selectedLabel}
							</span>
						</p>
					)}

					<div className="grid gap-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-sm border border-border p-1">
						{allowUnassign && (
							<button
								type="button"
								onClick={() => {
									setValue(UNASSIGNED);
									setSelectedLabel(null);
								}}
								className={`flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 rounded-sm text-sm text-left transition-colors ${
									value === UNASSIGNED
										? "bg-[#002388]/10 text-[#002388] font-semibold"
										: "text-slate-600 hover:bg-slate-50"
								}`}
							>
								<span className="truncate">Unassigned</span>
								{value === UNASSIGNED && <Check className="h-3.5 w-3.5 shrink-0" />}
							</button>
						)}

						{searchUrl && searching && (
							<div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Searching...
							</div>
						)}

						{searchUrl && !searching && !search.trim() ? (
							<p className="text-sm text-slate-500 text-center py-6">
								Start typing to search.
							</p>
						) : (!searchUrl || !searching) && filteredOptions.length === 0 ? (
							<p className="text-sm text-slate-500 text-center py-6">
								No matches for "{search}".
							</p>
						) : (
							!searching &&
							filteredOptions.map((opt) => {
								const optValue = String(opt.id);
								const isSelected = value === optValue;
								return (
									<button
										key={opt.id}
										type="button"
										onClick={() => handleSelect(opt)}
										title={opt.label}
										className={`flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 rounded-sm text-sm text-left transition-colors ${
											isSelected
												? "bg-[#002388]/10 text-[#002388] font-semibold"
												: "text-slate-600 hover:bg-slate-50"
										}`}
									>
										<span className="truncate">{opt.label}</span>
										{isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
									</button>
								);
							})
						)}
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={loading}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={!value || loading}
						onClick={handleConfirm}
						className="bg-[#002388] hover:bg-[#001570] text-white"
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Applying…
							</>
						) : (
							confirmLabel
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
