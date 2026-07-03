"use client";

import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import AddFacultySheet from "./AddFacultySheet";
import type { FacultySimple } from "@/lib/admin-entities";
import { toast } from "sonner";

export default function FacultiesClient({ initialFaculties }: { initialFaculties: FacultySimple[] }) {
  const [faculties, setFaculties] = useState<FacultySimple[]>(initialFaculties);
  const [open, setOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<FacultySimple | null>(null);
  const [selected, setSelected] = useState<FacultySimple[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<FacultySimple[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleSaved(faculty: FacultySimple, isNew: boolean) {
    if (isNew) {
      setFaculties(prev => [...prev, faculty].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setFaculties(prev => prev.map(f => f.id === faculty.id ? faculty : f));
    }
  }

  const handleEdit = (faculty: FacultySimple) => {
    setEditingFaculty(faculty);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);
    let failures = 0;
    for (const target of deleteTargets) {
      try {
        const res = await fetch(`/api/admin/faculties/${target.id}`, { method: "DELETE" });
        if (res.ok) {
          setFaculties(prev => prev.filter(f => f.id !== target.id));
        } else {
          failures++;
        }
      } catch {
        failures++;
      }
    }
    if (failures === 0) {
      toast.success(deleteTargets.length === 1 ? "Faculty deleted" : `${deleteTargets.length} faculties deleted`);
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => { setEditingFaculty(null); setOpen(true); }} className="rounded-sm bg-[#002388]">
          Add Faculty
        </Button>
      </div>

      {/*
        Azure/AWS-style command bar: Edit/Delete live as dedicated buttons that
        enable based on selection instead of a per-row kebab menu.
      */}
      <DataTable
        columns={columns}
        data={faculties}
        searchKey="name"
        placeholder="Search faculties..."
        enableSelection
        getRowId={(faculty) => faculty.id}
        onSelectionChange={setSelected}
        onRowClick={(faculty) => handleEdit(faculty)}
        toolbarActions={
          selected.length > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!singleSelected}
                onClick={() => singleSelected && handleEdit(singleSelected)}
                className="h-9 gap-1.5 px-3.5 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-50"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTargets(selected)}
                className="h-9 gap-1.5 px-3.5 rounded-sm border-rose-200 text-rose-600 text-[11px] font-semibold uppercase tracking-wider hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          ) : null
        }
      />

      <AddFacultySheet
        open={open}
        onOpenChange={setOpen}
        editingFaculty={editingFaculty}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={!!deleteTargets}
        title={deleteTargets && deleteTargets.length > 1 ? `Delete ${deleteTargets.length} faculties?` : "Delete Faculty?"}
        description={
          deleteTargets && deleteTargets.length > 1
            ? `Are you sure you want to delete these ${deleteTargets.length} faculties? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteTargets?.[0]?.name}"? This action cannot be undone.`
        }
        confirmText="Delete faculty"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargets(null)}
      />
    </div>
  );
}
