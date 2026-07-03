"use client";

import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import AddProgramSheet from "./AddProgramSheet";
import type { FacultySimple, ProgramSimple } from "@/lib/admin-entities";
import { toast } from "sonner";

type ProgramWithFaculty = ProgramSimple & { faculty: FacultySimple | null };

export default function ProgramsClient({ initialPrograms, faculties }: { initialPrograms: ProgramWithFaculty[]; faculties: FacultySimple[] }) {
  const [programs, setPrograms] = useState<ProgramWithFaculty[]>(initialPrograms);
  const [open, setOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramSimple | null>(null);
  const [selected, setSelected] = useState<ProgramWithFaculty[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<ProgramWithFaculty[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleSaved(program: ProgramWithFaculty, isNew: boolean) {
    if (isNew) {
      setPrograms(prev => [...prev, program].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setPrograms(prev => prev.map(p => p.id === program.id ? program : p));
    }
  }

  const handleEdit = (program: ProgramWithFaculty) => {
    setEditingProgram(program);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);
    let failures = 0;
    for (const target of deleteTargets) {
      try {
        const res = await fetch(`/api/admin/programs/${target.id}`, { method: "DELETE" });
        if (res.ok) {
          setPrograms(prev => prev.filter(p => p.id !== target.id));
        } else {
          failures++;
        }
      } catch {
        failures++;
      }
    }
    if (failures === 0) {
      toast.success(deleteTargets.length === 1 ? "Program deleted" : `${deleteTargets.length} programs deleted`);
    } else {
      toast.error(`${failures} of ${deleteTargets.length} deletions failed`);
    }
    setDeleteTargets(null);
    setSelected([]);
    setIsDeleting(false);
  };

  const singleSelected = selected.length === 1 ? selected[0] : null;

  const columns = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code", cell: ({ row }: any) => row.original.code || "-" },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }: any) => row.original.faculty?.name || "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => { setEditingProgram(null); setOpen(true); }} className="rounded-sm bg-[#002388]">
          Add Program
        </Button>
      </div>

      {/*
        Azure/AWS-style command bar: Edit/Delete live as dedicated buttons that
        enable based on selection instead of a per-row kebab menu.
      */}
      <DataTable
        columns={columns}
        data={programs}
        searchKey="name"
        placeholder="Search programs..."
        enableSelection
        getRowId={(program) => program.id}
        onSelectionChange={setSelected}
        onRowClick={(program) => handleEdit(program)}
        toolbarActions={
          selected.length > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!singleSelected}
                onClick={() => singleSelected && handleEdit(singleSelected)}
                className="h-10 gap-2 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTargets(selected)}
                className="h-10 gap-2 rounded-sm border-rose-200 text-rose-600 text-[11px] font-semibold uppercase tracking-wider hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          ) : null
        }
      />

      <AddProgramSheet
        open={open}
        onOpenChange={setOpen}
        faculties={faculties}
        editingProgram={editingProgram}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={!!deleteTargets}
        title={deleteTargets && deleteTargets.length > 1 ? `Delete ${deleteTargets.length} programs?` : "Delete Program?"}
        description={
          deleteTargets && deleteTargets.length > 1
            ? `Are you sure you want to delete these ${deleteTargets.length} programs? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteTargets?.[0]?.name}"? This action cannot be undone.`
        }
        confirmText="Delete program"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargets(null)}
      />
    </div>
  );
}
