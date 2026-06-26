"use client";

import { useState } from "react";
import { Edit2, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AddFacultySheet from "./AddFacultySheet";
import type { FacultySimple } from "@/lib/admin-entities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function FacultiesClient({ initialFaculties }: { initialFaculties: FacultySimple[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<FacultySimple | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FacultySimple | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/faculties/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Faculty deleted");
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to delete faculty");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code", cell: ({ row }: any) => row.original.code || "-" },
    {
      id: "actions",
      header: "",
      cell: ({ row }: any) => {
        const faculty = row.original as FacultySimple;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all">
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingFaculty(faculty);
                    setOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" /> Edit Faculty
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteTarget(faculty)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={() => {
            setEditingFaculty(null);
            setOpen(true);
          }}
          className="bg-[#002388]"
        >
          Add Faculty
        </Button>
      </div>

      <DataTable columns={columns} data={initialFaculties} searchKey="name" placeholder="Search faculties..." />

      <AddFacultySheet open={open} onOpenChange={setOpen} editingFaculty={editingFaculty} />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Faculty?"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete faculty"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
