"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
	label: string;
	icon: LucideIcon;
	onClick: () => void;
	disabled?: boolean;
	destructive?: boolean;
	/** Renders a separator above this action. */
	separatorBefore?: boolean;
};

interface RowActionsMenuProps {
	actions: RowAction[];
	label?: string;
}

export function RowActionsMenu({ actions, label = "Actions" }: RowActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
				>
					<MoreHorizontal className="h-3.5 w-3.5" />
					{label}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56 rounded-md p-1.5">
				{actions.map((action, i) => {
					const Icon = action.icon;
					return (
						<div key={action.label}>
							{action.separatorBefore && i > 0 && (
								<DropdownMenuSeparator className="my-1.5" />
							)}
							<DropdownMenuItem
								disabled={action.disabled}
								onClick={action.onClick}
								variant={action.destructive ? "destructive" : "default"}
								className="gap-2.5 rounded-sm px-2.5 py-2 text-[13px] font-medium"
							>
								<Icon className="h-4 w-4" />
								{action.label}
							</DropdownMenuItem>
						</div>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
