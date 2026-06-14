"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import AddFacultySheet from "./AddFacultySheet";
import type { FacultySimple } from "@/lib/admin-entities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function FacultiesClient({ initialFaculties }: { initialFaculties: FacultySimple[] }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const router = useRouter();

  const columns = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
  ];

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/faculties/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Faculty deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete faculty");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => setOpen(true)} className="bg-[#002388]">Add Faculty</Button>
      </div>

      <DataTable columns={columns} data={initialFaculties} searchKey="name" placeholder="Search faculties..." />

      <AddFacultySheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
