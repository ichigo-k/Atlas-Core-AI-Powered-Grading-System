"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ClassWithDetails } from "@/lib/admin-classes";

export default function AddEditClassSheet({
	open,
	onOpenChange,
	editingClass,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingClass: ClassWithDetails | null;
}) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [name, setName] = useState("");
	const [level, setLevel] = useState("100");

	useEffect(() => {
		if (open) {
			if (editingClass) {
				setName(editingClass.name);
				setLevel(editingClass.level.toString());
			} else {
				setName("");
				setLevel("100");
			}
		}
	}, [open, editingClass]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || !level) return;

		setIsPending(true);
		try {
			const method = editingClass ? "PATCH" : "POST";
			const url = editingClass ? `/api/admin/classes/${editingClass.id}` : `/api/admin/classes`;
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, level }),
			});

			if (res.ok) {
				toast.success(editingClass ? "Class updated successfully" : "Class created successfully");
				onOpenChange(false);
				router.refresh();
			} else if (res.status === 409) {
				toast.error("A class with this name and level already exists.");
			} else {
				toast.error("Something went wrong. Please try again.");
			}
		} catch (error) {
			toast.error("An error occurred. Please try again.");
		} finally {
			setIsPending(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
				<SheetHeader className="mb-6 text-left">
					<SheetTitle className="text-xl font-bold text-slate-900">
						{editingClass ? "Edit Class" : "Add New Class"}
					</SheetTitle>
					<SheetDescription className="text-sm text-slate-500">
						{editingClass ? "Update the class details below." : "Enter details for the new class."}
					</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<Label htmlFor="name" className="text-slate-700 font-medium">Class Name</Label>
						<Input 
							id="name" 
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. BIT Group B" 
							className="rounded-sm h-10 border-border focus-visible:ring-[#002388]" 
							required
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="level" className="text-slate-700 font-medium">Level</Label>
						<Input 
							id="level" 
							type="number"
							value={level}
							onChange={(e) => setLevel(e.target.value)}
							placeholder="e.g. 100" 
							className="rounded-sm h-10 border-border focus-visible:ring-[#002388]" 
							required
						/>
					</div>

					<SheetFooter className="mt-4 pt-4 border-t border-slate-100">
						<Button
							type="submit"
							disabled={isPending}
							className="w-full bg-[#002388] hover:bg-[#001570] text-white rounded-sm h-10 font-medium transition-colors flex items-center justify-center gap-2"
						>
							{isPending && <Loader2 className="h-4 w-4 animate-spin" />}
							<span>{editingClass ? "Save Changes" : "Create Class"}</span>
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
