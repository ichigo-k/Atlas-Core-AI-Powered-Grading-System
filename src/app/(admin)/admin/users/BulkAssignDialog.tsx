"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
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
	options: BulkAssignOption[];
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
	confirmLabel,
	allowUnassign = false,
	onConfirm,
}: BulkAssignDialogProps) {
	const [value, setValue] = useState<string>("");
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);

	const filteredOptions = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return options;
		return options.filter((o) => o.label.toLowerCase().includes(query));
	}, [options, search]);

	const selectedLabel =
		value === UNASSIGNED
			? "Unassigned"
			: options.find((o) => String(o.id) === value)?.label;

	const handleConfirm = async () => {
		if (!value) return;
		setLoading(true);
		try {
			await onConfirm(value === UNASSIGNED ? null : Number(value));
			setValue("");
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

					{selectedLabel && (
						<p className="text-xs font-medium text-slate-500">
							Selected: <span className="text-[#002388] font-semibold">{selectedLabel}</span>
						</p>
					)}

					<div className="grid gap-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-sm border border-border p-1">
						{allowUnassign && (
							<button
								type="button"
								onClick={() => setValue(UNASSIGNED)}
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
						{filteredOptions.length === 0 ? (
							<p className="text-sm text-slate-500 text-center py-6">
								No matches for "{search}".
							</p>
						) : (
							filteredOptions.map((opt) => {
								const optValue = String(opt.id);
								const isSelected = value === optValue;
								return (
									<button
										key={opt.id}
										type="button"
										onClick={() => setValue(optValue)}
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
