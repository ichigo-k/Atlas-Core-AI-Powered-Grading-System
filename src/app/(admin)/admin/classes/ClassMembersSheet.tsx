"use client";

import { useEffect, useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import type { ClassWithDetails } from "@/lib/admin-classes";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Member = {
	id: number;
	name: string | null;
	email: string;
	status: string;
	program: string;
};

export default function ClassMembersSheet({
	open,
	onOpenChange,
	cls,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cls: ClassWithDetails | null;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const [members, setMembers] = useState<Member[]>([]);

	useEffect(() => {
		if (open && cls) {
			setIsLoading(true);
			fetch(`/api/admin/classes/${cls.id}/members`)
				.then((res) => res.json())
				.then((data: Member[]) => {
					setMembers(data);
				})
				.finally(() => setIsLoading(false));
		}
	}, [open, cls]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto p-6 flex flex-col h-full">
				<SheetHeader className="mb-6 text-left shrink-0">
					<SheetTitle className="text-xl font-bold text-slate-900">
						Class Members
					</SheetTitle>
					<SheetDescription className="text-sm text-slate-500">
						Viewing students in {cls?.name} Level {cls?.level}.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto pr-2">
					{isLoading ? (
						<div className="flex justify-center items-center h-32">
							<Loader2 className="h-6 w-6 animate-spin text-[#002388]" />
						</div>
					) : members.length === 0 ? (
						<p className="text-sm text-slate-500 text-center mt-8">No students in this class.</p>
					) : (
						<div className="space-y-3">
							{members.map((m: any) => (
								<div key={m.id} className="p-3 rounded-sm border border-slate-100 bg-slate-50 flex items-start justify-between">
									<div className="space-y-1">
										<p className="font-semibold text-slate-800 text-sm">{m.name || "—"}</p>
										<p className="text-xs text-slate-500">{m.email}</p>
									</div>
									<Badge variant={m.status === "ACTIVE" ? "success" : "warning"} className="text-[10px]">
										{m.status}
									</Badge>
								</div>
							))}
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
