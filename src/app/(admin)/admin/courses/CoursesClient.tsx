"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import AddEditCourseSheet from "./AddEditCourseSheet";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit2, Trash2 } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteCourseAction } from "@/app/actions/admin-courses";
import type { CourseWithDetails } from "@/lib/admin-classes";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import CourseDetailSheet from "./CourseDetailSheet";

interface CoursesClientProps {
  courses: CourseWithDetails[];
  classes: any[];
  lecturers: any[];
}

export default function CoursesClient({ courses, classes, lecturers }: CoursesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [addEditOpen, setAddEditOpen] = useState(false);
  const [selected, setSelected] = useState<CourseWithDetails[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<CourseWithDetails[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailCourse, setDetailCourse] = useState<CourseWithDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setAddEditOpen(true);
    }
  }, [searchParams]);

  // Keep the open drawer's data in sync after server-action refreshes.
  useEffect(() => {
    if (!detailCourse) return;
    const fresh = courses.find((c) => c.id === detailCourse.id);
    if (fresh && fresh !== detailCourse) setDetailCourse(fresh);
  }, [courses, detailCourse]);

  const handleCloseAddEdit = (open: boolean) => {
    if (!open) {
      setAddEditOpen(false);
      // Clear the 'add' param from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("add");
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    } else {
      setAddEditOpen(true);
    }
  };

  const handleOpenDetail = (course: CourseWithDetails) => {
    setDetailCourse(course);
    setDetailOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);

    const failureMessages: string[] = [];
    for (const target of deleteTargets) {
      const result = await deleteCourseAction(target.id);
      if (!result.success) failureMessages.push(result.error || `Failed to delete ${target.title}`);
    }
    if (failureMessages.length === 0) {
      toast.success(
        deleteTargets.length === 1
          ? "Course deleted successfully"
          : `${deleteTargets.length} courses deleted successfully`,
      );
    } else if (failureMessages.length === 1) {
      toast.error(failureMessages[0]);
    } else {
      toast.error(`${failureMessages.length} of ${deleteTargets.length} deletions failed: ${failureMessages.join(" ")}`);
    }
    setDeleteTargets(null);
    setSelected([]);
    setIsDeleting(false);
  };

  const singleSelected = selected.length === 1 ? selected[0] : null;

  const columns: ColumnDef<CourseWithDetails>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-transparent"
          >
            Course Title
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="min-w-0 group">
          <p className="truncate font-semibold text-slate-900 group-hover:text-[#002388] transition-colors">
            {row.getValue("title")}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {row.original.code}
            </p>
            <span className="text-[10px] text-slate-300">•</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {row.original.credits} Credits
            </p>
          </div>
        </div>
      ),
      filterFn: (row, _columnId, value) => {
        const query = String(value).toLowerCase();
        return (
          row.original.title.toLowerCase().includes(query) ||
          row.original.code.toLowerCase().includes(query)
        );
      },
    },
    {
      id: "lecturers",
      header: "Lecturers",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700">{row.original.lecturers.length}</span>
        </div>
      ),
    },
    {
      id: "classes",
      header: "Classes",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700">{row.original.classes.length}</span>
        </div>
      ),
    },
  ];

  const rowActions: RowAction[] = [
    {
      label: "Open",
      icon: Edit2,
      disabled: !singleSelected,
      onClick: () => singleSelected && handleOpenDetail(singleSelected),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onClick: () => setDeleteTargets(selected),
    },
  ];

  return (
    <div className="space-y-8">
      <AddEditCourseSheet
        open={addEditOpen}
        onOpenChange={handleCloseAddEdit}
      />

      <CourseDetailSheet
        course={detailCourse}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        classes={classes}
        lecturers={lecturers}
      />

      <ConfirmModal
        open={!!deleteTargets}
        title={
          deleteTargets && deleteTargets.length > 1
            ? `Delete ${deleteTargets.length} courses?`
            : "Delete Course?"
        }
        description={
          deleteTargets && deleteTargets.length > 1
            ? `Are you sure you want to delete these ${deleteTargets.length} courses? This action will remove them and all their associations. It cannot be undone.`
            : `Are you sure you want to delete ${deleteTargets?.[0]?.code}: ${deleteTargets?.[0]?.title}? This action will remove the course and all its associations. It cannot be undone.`
        }
        confirmText="Delete Course"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTargets(null)}
      />

      {/*
        Azure/AWS-style command bar: Edit/Delete live as dedicated buttons that
        enable based on selection instead of a per-row kebab menu. Click a row
        to open it directly.
      */}
      <DataTable
        columns={columns}
        data={courses}
        searchKey="title"
        placeholder="Search courses by title or code..."
        enableSelection
        getRowId={(course) => course.id}
        onSelectionChange={setSelected}
        onRowClick={(course) => handleOpenDetail(course)}
        toolbarActions={selected.length > 0 ? <RowActionsMenu actions={rowActions} /> : null}
      />
    </div>
  );
}
