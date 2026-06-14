"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UserStatus } from "@prisma/client";
import { logAction } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function toggleUserStatusAction(userId: number, currentStatus: UserStatus) {
  try {
    await requireAdmin();
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus as UserStatus },
    });

    await logAction(
      "USER_STATUS_CHANGED",
      `User ID ${userId} status changed to ${newStatus}`,
      "USER"
    );

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle status:", error);
    return { success: false, error: "Failed to update user status" };
  }
}

export async function deleteUserAction(userId: number) {
  try {
    await requireAdmin();
    // Delete profiles first if they don't have cascade (Prisma handles this based on schema usually)
    // But here they are linked by ID
    await prisma.$transaction([
      prisma.studentProfile.deleteMany({ where: { id: userId } }),
      prisma.lecturerProfile.deleteMany({ where: { id: userId } }),
      prisma.adminProfile.deleteMany({ where: { id: userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await logAction(
      "USER_DELETED",
      `User account with ID ${userId} was permanently deleted`,
      "USER"
    );

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}

export async function updateUserAction(userId: number, formData: FormData) {
  try {
    await requireAdmin();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, lecturerProfile: true },
    });

    if (!user) return { success: false, error: "User not found" };

    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
    });

    if (user.role === "STUDENT") {
      const indexNumber = formData.get("indexNumber") as string;
      const program = formData.get("program") as string;
      await prisma.studentProfile.update({
        where: { id: userId },
        data: { indexNumber, legacyProgram: program },
      });
    } else if (user.role === "LECTURER") {
      const department = formData.get("department") as string;
      const title = formData.get("title") as string;
      await prisma.lecturerProfile.update({
        where: { id: userId },
        data: { department, title },
      });
    }

    await logAction(
      "USER_UPDATED",
      `Information for user "${name}" was updated`,
      "USER"
    );

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to update user:", error);
    return { success: false, error: "Failed to update user" };
  }
}

export async function reassignClassAction(userId: number, classId: number) {
  try {
    await requireAdmin();
    await prisma.studentProfile.update({
      where: { id: userId },
      data: { classId },
    });

    await logAction(
      "CLASS_ASSIGNED",
      `Student ID ${userId} was assigned to class ID ${classId}`,
      "CLASS"
    );

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to reassign class:", error);
    return { success: false, error: "Failed to reassign class" };
  }
}
