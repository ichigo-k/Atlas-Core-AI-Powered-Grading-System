"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { FacultySimple, ProgramSimple } from "@/lib/admin-entities";

export default function AddProgramSheet({
	open,
	onOpenChange,
	faculties,
	editingProgram,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	faculties: FacultySimple[];
	editingProgram?: ProgramSimple | null;
}) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [facultyId, setFacultyId] = useState<number | null>(null);

	const isEditing = !!editingProgram;

	useEffect(() => {
		if (open) {
			setName(editingProgram?.name ?? "");
			setCode(editingProgram?.code ?? "");
			setFacultyId(editingProgram?.facultyId ?? faculties?.[0]?.id ?? null);
		}
	}, [open, editingProgram, faculties]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!facultyId) {
			toast.error("Faculty is required");
			return;
		}

		setLoading(true);
		try {
			if (isEditing) {
				const res = await fetch(`/api/admin/programs/${editingProgram.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: name.trim(), code: code.trim(), facultyId }),
				});
				if (res.ok) {
					toast.success("Program updated");
					onOpenChange(false);
					router.refresh();
				} else if (res.status === 409) {
					toast.error("A program with this name or code already exists");
				} else {
					toast.error("Failed to update program");
				}
			} else {
				const formData = new FormData();
				formData.set("name", name.trim());
				if (code.trim()) formData.set("code", code.trim());
				formData.set("facultyId", String(facultyId));
				const res = await createProgramAction(formData);
				if (res.success) {
					toast.success("Program created");
					onOpenChange(false);
					router.refresh();
				} else {
					toast.error(res.error || "Failed to create program");
				}
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
									{isEditing ? "Edit Program" : "Add Program"}
								</SheetTitle>
								<SheetDescription className="text-xs text-slate-500">
									{isEditing
										? "Update the academic program details"
										: "Create a new academic program"}
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<form
							id="program-form"
							onSubmit={handleSubmit}
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
									value={name}
									onChange={(e) => setName(e.target.value)}
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
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="e.g. BIT"
									className="h-11"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight">
									Faculty
								</Label>
								<Select
									value={facultyId ? String(facultyId) : undefined}
									onValueChange={(val) => setFacultyId(Number(val))}
								>
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
							{loading
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Create Program"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
