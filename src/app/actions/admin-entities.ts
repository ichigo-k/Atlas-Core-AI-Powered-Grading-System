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

export async function createFacultyAction(formData: FormData) {
  try {
    await requireAdmin();
    const name = formData.get("name") as string;
    const code = (formData.get("code") as string) || undefined;
    if (!name) return { success: false, error: "Name is required" };

    const faculty = await prisma.faculty.create({ data: { name, code } });
    await logAction("FACULTY_CREATED", `Faculty created: ${name}`, "FACULTY");
    revalidatePath("/admin/faculties");
    return { success: true, data: faculty };
  } catch (err: any) {
    console.error("[createFacultyAction]", err);
    if (err.code === "P2002") return { success: false, error: "Duplicate faculty" };
    return { success: false, error: "Failed to create faculty" };
  }
}

export async function createProgramAction(formData: FormData) {
  try {
    await requireAdmin();
    const name = formData.get("name") as string;
    const code = (formData.get("code") as string) || undefined;
    const facultyId = parseInt(formData.get("facultyId") as string);
    if (!name) return { success: false, error: "Name is required" };
    if (Number.isNaN(facultyId)) return { success: false, error: "facultyId is required" };

    const program = await prisma.program.create({ data: { name, code, facultyId } });
    await logAction("PROGRAM_CREATED", `Program created: ${name}`, "PROGRAM");
    revalidatePath("/admin/programs");
    return { success: true, data: program };
  } catch (err: any) {
    console.error("[createProgramAction]", err);
    if (err.code === "P2002") return { success: false, error: "Duplicate program" };
    return { success: false, error: "Failed to create program" };
  }
}
