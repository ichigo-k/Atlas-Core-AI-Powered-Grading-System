"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createProgramAction } from "@/app/actions/admin-entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { FacultySimple } from "@/lib/admin-entities";

export default function AddProgramSheet({
	open,
	onOpenChange,
	faculties,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	faculties: FacultySimple[];
}) {
	const [loading, setLoading] = useState(false);
	const [facultyId, setFacultyId] = useState<number | null>(
		faculties?.[0]?.id ?? null,
	);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		try {
			if (facultyId) formData.set("facultyId", String(facultyId));
			const res = await createProgramAction(formData);
			if (res.success) {
				toast.success("Program created");
				onOpenChange(false);
			} else {
				toast.error(res.error || "Failed to create program");
			}
		} catch {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[540px] p-0 border-l border-border">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="text-left flex-1">
								<SheetTitle className="text-xl font-bold text-slate-900">
									Add Program
								</SheetTitle>
								<SheetDescription className="text-xs text-slate-500">
									Create a new academic program
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<form
							id="program-form"
							action={handleSubmit}
							className="p-8 space-y-6"
						>
							<div className="space-y-2">
								<Label
									htmlFor="name"
									className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
								>
									Name
								</Label>
								<Input
									id="name"
									name="name"
									placeholder="e.g. Bachelor of Information Technology"
									className="h-11"
								/>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="code"
									className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
								>
									Code (optional)
								</Label>
								<Input
									id="code"
									name="code"
									placeholder="e.g. BIT"
									className="h-11"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
									Faculty
								</Label>
								<Select onValueChange={(val) => setFacultyId(Number(val))}>
									<SelectTrigger>
										<SelectValue placeholder="Select faculty" />
									</SelectTrigger>
									<SelectContent>
										{faculties.map((f) => (
											<SelectItem key={f.id} value={String(f.id)}>
												{f.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</form>
					</div>

					<div className="p-8 border-t border-slate-100 bg-slate-50/50">
						<Button
							type="submit"
							form="program-form"
							className="w-full h-12 bg-[#002388] text-white"
							disabled={loading}
						>
							{loading ? "Creating..." : "Create Program"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
