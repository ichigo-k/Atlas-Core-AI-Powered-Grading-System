"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import AddProgramSheet from "./AddProgramSheet";
import type { ProgramSimple, FacultySimple } from "@/lib/admin-entities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProgramsClient({ initialPrograms, faculties }: { initialPrograms: any[]; faculties: FacultySimple[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const columns = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
    { accessorKey: "faculty", header: "Faculty", cell: (row: any) => row.faculty?.name || "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => setOpen(true)} className="bg-[#002388]">Add Program</Button>
      </div>

      <DataTable columns={columns} data={initialPrograms} searchKey="name" placeholder="Search programs..." />

      <AddProgramSheet open={open} onOpenChange={setOpen} faculties={faculties} />
    </div>
  );
}
