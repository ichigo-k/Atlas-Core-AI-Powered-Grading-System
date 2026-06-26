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
import AddProgramSheet from "./AddProgramSheet";
import type { FacultySimple, ProgramSimple } from "@/lib/admin-entities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ProgramWithFaculty = ProgramSimple & { faculty: FacultySimple | null };

export default function ProgramsClient({ initialPrograms, faculties }: { initialPrograms: ProgramWithFaculty[]; faculties: FacultySimple[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramSimple | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramWithFaculty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/programs/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Program deleted");
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to delete program");
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
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }: any) => row.original.faculty?.name || "-" },
    {
      id: "actions",
      header: "",
      cell: ({ row }: any) => {
        const program = row.original as ProgramWithFaculty;
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
                    setEditingProgram(program);
                    setOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" /> Edit Program
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteTarget(program)} className="text-red-600">
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
            setEditingProgram(null);
            setOpen(true);
          }}
          className="bg-[#002388]"
        >
          Add Program
        </Button>
      </div>

      <DataTable columns={columns} data={initialPrograms} searchKey="name" placeholder="Search programs..." />

      <AddProgramSheet open={open} onOpenChange={setOpen} faculties={faculties} editingProgram={editingProgram} />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Program?"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete program"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
