"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

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
	const [loading, setLoading] = useState(false);

	const handleConfirm = async () => {
		if (!value) return;
		setLoading(true);
		try {
			await onConfirm(value === "__unassigned__" ? null : Number(value));
			setValue("");
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
					if (!next) setValue("");
				}
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<Select value={value} onValueChange={setValue}>
					<SelectTrigger className="h-10 rounded-sm border-border">
						<SelectValue placeholder="Select an option..." />
					</SelectTrigger>
					<SelectContent className="rounded-sm">
						{allowUnassign && (
							<SelectItem value="__unassigned__" className="text-sm">
								Unassigned
							</SelectItem>
						)}
						{options.map((opt) => (
							<SelectItem key={opt.id} value={String(opt.id)} className="text-sm">
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

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
