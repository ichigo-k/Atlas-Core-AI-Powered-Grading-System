"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import AddEditCourseSheet from "./AddEditCourseSheet";
import { ColumnDef } from "@tanstack/react-table";
import {
  BookPlus,
  MoreVertical,
  UserPlus,
  BookOpen,
  ArrowUpDown,
  Edit2,
  Trash2
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteCourseAction } from "@/app/actions/admin-courses";
import type { CourseWithDetails } from "@/lib/admin-classes";

import { ConfirmModal } from "@/components/ui/confirm-modal";

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
  const [selectedCourse, setSelectedCourse] = useState<CourseWithDetails | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<CourseWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setSelectedCourse(null);
      setAddEditOpen(true);
    }
  }, [searchParams]);

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

  const handleEdit = (course: CourseWithDetails) => {
    setSelectedCourse(course);
    setAddEditOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteCourse) return;
    setIsDeleting(true);

    const result = await deleteCourseAction(deleteCourse.id);
    if (result.success) {
      toast.success("Course deleted successfully");
      setDeleteCourse(null);
    } else {
      toast.error(result.error || "Failed to delete course");
    }
    setIsDeleting(false);
  };

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
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="text-right">
            <TooltipProvider>
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleEdit(row.original)}
                      className="p-2 text-slate-400 hover:text-[#002388] hover:bg-[#002388]/5 rounded-sm transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Details</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                      onClick={() => setDeleteCourse(row.original)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Course
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TooltipProvider>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <AddEditCourseSheet
        course={selectedCourse}
        open={addEditOpen}
        onOpenChange={handleCloseAddEdit}
        classes={classes}
        lecturers={lecturers}
      />

      <ConfirmModal
        open={!!deleteCourse}
        title="Delete Course?"
        description={`Are you sure you want to delete ${deleteCourse?.code}: ${deleteCourse?.title}? This action will remove the course and all its associations. It cannot be undone.`}
        confirmText="Delete Course"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteCourse(null)}
      />

      <DataTable
        columns={columns}
        data={courses}
        searchKey="title"
        placeholder="Search courses by title..."
      />
    </div>
  );
}
