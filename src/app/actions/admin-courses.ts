"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function createCourseAction(formData: FormData) {
  try {
    await requireAdmin();
    const code = formData.get("code") as string;
    const title = formData.get("title") as string;
    const credits = parseInt(formData.get("credits") as string);

    const course = await prisma.course.create({
      data: { code, title, credits },
    });

    await logAction(
      "COURSE_CREATED",
      `New course "${title}" (${code}) was created`,
      "COURSE"
    );

    revalidatePath("/admin/courses");
    return { success: true, courseId: course.id };
  } catch (error: any) {
    console.error("Failed to create course:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A course with this code already exists." };
    }
    return { success: false, error: "Failed to create course" };
  }
}

export async function updateCourseAction(courseId: number, formData: FormData) {
  try {
    await requireAdmin();
    const code = formData.get("code") as string;
    const title = formData.get("title") as string;
    const credits = parseInt(formData.get("credits") as string);

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: { code, title, credits },
    });

    await logAction(
      "COURSE_UPDATED",
      `Course "${updated.title}" (${updated.code}) was updated`,
      "COURSE"
    );

    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update course:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A course with this code already exists." };
    }
    return { success: false, error: "Failed to update course" };
  }
}

export async function deleteCourseAction(courseId: number) {
  try {
    await requireAdmin();

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        code: true,
        classes: { select: { name: true, level: true } },
        _count: { select: { assessments: true } },
      },
    });
    if (!course) {
      return { success: false, error: "Course not found" };
    }
    if (course.classes.length > 0) {
      const names = course.classes.map((c) => `${c.name} (L${c.level})`).join(", ");
      return {
        success: false,
        error: `"${course.title}" is assigned to ${course.classes.length} class${course.classes.length === 1 ? "" : "es"} (${names}). Unassign it from those classes before deleting.`,
      };
    }
    if (course._count.assessments > 0) {
      return {
        success: false,
        error: `"${course.title}" has ${course._count.assessments} assessment${course._count.assessments === 1 ? "" : "s"} created under it and cannot be deleted.`,
      };
    }

    const deleted = await prisma.course.delete({
      where: { id: courseId },
    });

    await logAction(
      "COURSE_DELETED",
      `Course "${deleted.title}" (${deleted.code}) was deleted`,
      "COURSE"
    );
    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete course:", error);
    return { success: false, error: "Failed to delete course. It might be linked to other records." };
  }
}

export async function toggleCourseClassAction(courseId: number, classId: number, isAssigned: boolean) {
  try {
    await requireAdmin();
    if (isAssigned) {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          classes: {
            disconnect: { id: classId }
          }
        }
      });
    } else {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          classes: {
            connect: { id: classId }
          }
        }
      });
    }
    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle course-class assignment:", error);
    return { success: false, error: "Failed to update class assignment" };
  }
}

export async function toggleCourseLecturerAction(courseId: number, lecturerId: number, isAssigned: boolean) {
  try {
    await requireAdmin();
    if (isAssigned) {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          lecturers: {
            disconnect: { id: lecturerId }
          }
        }
      });
    } else {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          lecturers: {
            connect: { id: lecturerId }
          }
        }
      });
    }
    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update lecturer assignment" };
  }
}

export async function updateCourseAssignmentsAction(courseId: number, lecturerIds: number[], classIds: number[]) {
  try {
    await requireAdmin();
    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        lecturers: {
          set: lecturerIds.map(id => ({ id }))
        },
        classes: {
          set: classIds.map(id => ({ id }))
        }
      },
      include: {
        lecturers: true,
        classes: true
      }
    });

    await logAction(
      "COURSE_ASSIGNED",
      `Course "${updated.title}" assignments were updated (${updated.lecturers.length} lecturers, ${updated.classes.length} classes)`,
      "COURSE"
    );
    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    console.error("Failed to update course assignments:", error);
    return { success: false, error: "Failed to update assignments" };
  }
}
