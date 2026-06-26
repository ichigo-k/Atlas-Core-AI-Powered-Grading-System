"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFacultyAction } from "@/app/actions/admin-entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { FacultySimple } from "@/lib/admin-entities";

export default function AddFacultySheet({
	open,
	onOpenChange,
	editingFaculty,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	editingFaculty?: FacultySimple | null;
}) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [name, setName] = useState("");
	const [code, setCode] = useState("");

	const isEditing = !!editingFaculty;

	useEffect(() => {
		if (open) {
			setName(editingFaculty?.name ?? "");
			setCode(editingFaculty?.code ?? "");
		}
	}, [open, editingFaculty]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}

		setLoading(true);
		try {
			if (isEditing) {
				const res = await fetch(`/api/admin/faculties/${editingFaculty.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: name.trim(), code: code.trim() }),
				});
				if (res.ok) {
					toast.success("Faculty updated");
					onOpenChange(false);
					router.refresh();
				} else if (res.status === 409) {
					toast.error("A faculty with this name or code already exists");
				} else {
					toast.error("Failed to update faculty");
				}
			} else {
				const formData = new FormData();
				formData.set("name", name.trim());
				if (code.trim()) formData.set("code", code.trim());
				const res = await createFacultyAction(formData);
				if (res.success) {
					toast.success("Faculty created");
					onOpenChange(false);
					router.refresh();
				} else {
					toast.error(res.error || "Failed to create faculty");
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
									{isEditing ? "Edit Faculty" : "Add Faculty"}
								</SheetTitle>
								<SheetDescription className="text-xs text-slate-500">
									{isEditing
										? "Update the faculty details"
										: "Create a new faculty"}
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<form
							id="faculty-form"
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
									placeholder="e.g. Faculty of Science"
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
									placeholder="e.g. SCI"
									className="h-11"
								/>
							</div>
						</form>
					</div>

					<div className="p-8 border-t border-slate-100 bg-slate-50/50">
						<Button
							type="submit"
							form="faculty-form"
							className="w-full h-12 bg-[#002388] text-white"
							disabled={loading}
						>
							{loading
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Create Faculty"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
