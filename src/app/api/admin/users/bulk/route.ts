import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAction } from "@/lib/audit";
import ExcelJS from "exceljs";

type RowError = { row: number; field: string; message: string };

const VALID_TITLES = ["Dr.", "Prof.", "Mr.", "Mrs.", "Ms."] as const;

const REQUIRED_FIELDS: Record<string, string[]> = {
  STUDENT: ["email", "name", "indexnumber", "program"],
  LECTURER: ["email", "name", "faculty", "title"],
  ADMIN: ["email", "name"],
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const role = formData.get("role") as string;
  const file = formData.get("file") as File | null;

  if (!role || !["STUDENT", "LECTURER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
  }

  const requiredFields = REQUIRED_FIELDS[role];
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    return NextResponse.json({ error: "Could not parse Excel file" }, { status: 400 });
  }

  const sheet = workbook.getWorksheet(1);
  if (!sheet) {
    return NextResponse.json({ error: "Excel file has no worksheets" }, { status: 400 });
  }

  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      headers = (row.values as string[]).map(h =>
        typeof h === "string" ? h.toLowerCase().trim() : "",
      );
    } else {
      const rowData: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        let val = row.getCell(idx).value;
        if (typeof val === "object" && val !== null) {
          if ("text" in val) val = (val as any).text;
          else if ("result" in val) val = (val as any).result;
        }
        rowData[h] = val ? String(val).trim() : "";
      });
      if (Object.values(rowData).some(v => v !== "")) rows.push(rowData);
    }
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Excel file contains no data rows" }, { status: 400 });
  }

  // Pre-fetch lookup maps before streaming starts
  const classMap = new Map<string, number>();
  const programMap = new Map<string, number>();
  const facultyMap = new Map<string, number>();

  if (role === "STUDENT") {
    const [programs, classes] = await Promise.all([
      prisma.program.findMany({ orderBy: { name: "asc" } }),
      prisma.class.findMany({ where: { isGraduated: false } }),
    ]);
    for (const p of programs) programMap.set(p.name.toLowerCase(), p.id);
    for (const c of classes) classMap.set(`${c.name} - Level ${c.level}`.toLowerCase(), c.id);
  } else if (role === "LECTURER") {
    const faculties = await prisma.faculty.findMany({ orderBy: { name: "asc" } });
    for (const f of faculties) facultyMap.set(f.name.toLowerCase(), f.id);
  }

  // Stream NDJSON progress events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let created = 0;
      const errors: RowError[] = [];

      try {
        send({ type: "start", total: rows.length });

        for (let i = 0; i < rows.length; i++) {
          const rowNum = i + 2;
          const row = rows[i];

          // Required field validation
          let skip = false;
          for (const field of requiredFields) {
            if (!row[field]) {
              errors.push({ row: rowNum, field, message: `${field} is required` });
              skip = true;
              break;
            }
          }

          if (!skip) {
            try {
              const emailLocal = row.email.includes("@") ? row.email.split("@")[0] : row.email;
              const passwordHash = await bcrypt.hash(emailLocal, 12);

              if (role === "STUDENT") {
                const indexNumber =
                  row.indexnumber?.trim() ||
                  row.index_number?.trim() ||
                  row.indexNumber?.trim() ||
                  "";
                if (!indexNumber) {
                  errors.push({ row: rowNum, field: "indexNumber", message: "Index number is required" });
                } else {
                  const programId = programMap.get(row.program.toLowerCase()) ?? null;
                  if (!programId) {
                    errors.push({ row: rowNum, field: "program", message: "Selected program is not valid" });
                  } else {
                    let classId: number | null = null;
                    if (row.class) {
                      classId = classMap.get(row.class.toLowerCase()) ?? null;
                      if (classId === null) {
                        errors.push({ row: rowNum, field: "class", message: "Selected class is not valid" });
                        skip = true;
                      }
                    }
                    if (!skip) {
                      await prisma.$transaction(async tx => {
                        const user = await tx.user.create({
                          data: { email: row.email, name: row.name, role: "STUDENT", passwordHash },
                        });
                        await tx.studentProfile.create({
                          data: { id: user.id, indexNumber, legacyProgram: row.program, programId, classId },
                        });
                      });
                      created++;
                    }
                  }
                }
              } else if (role === "LECTURER") {
                const facultyName = row.faculty?.trim() || row.department?.trim() || "";
                const facultyId = facultyMap.get(facultyName.toLowerCase()) ?? null;
                if (!facultyId) {
                  errors.push({ row: rowNum, field: "faculty", message: "Selected faculty is not valid" });
                } else {
                  const title = row.title?.trim() || "";
                  if (!VALID_TITLES.includes(title as (typeof VALID_TITLES)[number])) {
                    errors.push({ row: rowNum, field: "title", message: "Selected title is not valid" });
                  } else {
                    await prisma.$transaction(async tx => {
                      const user = await tx.user.create({
                        data: { email: row.email, name: row.name, role: "LECTURER", passwordHash },
                      });
                      await tx.lecturerProfile.create({ data: { id: user.id, facultyId, title } });
                    });
                    created++;
                  }
                }
              } else {
                await prisma.$transaction(async tx => {
                  const user = await tx.user.create({
                    data: { email: row.email, name: row.name, role: "ADMIN", passwordHash },
                  });
                  await tx.adminProfile.create({ data: { id: user.id } });
                });
                created++;
              }
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                errors.push({ row: rowNum, field: "email", message: "Email already exists" });
              } else {
                errors.push({ row: rowNum, field: "unknown", message: "Unexpected error creating user" });
              }
            }
          }

          // Push progress every 5 rows and on the last row
          if ((i + 1) % 5 === 0 || i === rows.length - 1) {
            send({ type: "progress", processed: i + 1, total: rows.length, created, failed: errors.length });
          }
        }

        if (created > 0) {
          await logAction(
            "USER_BULK_IMPORT",
            `Bulk import: ${created} ${role.toLowerCase()}s created`,
            "USER",
          );
        }

        send({ type: "done", created, failed: errors.length, errors });
      } catch (err) {
        console.error("[POST /api/admin/users/bulk] stream error", {
          error: err instanceof Error ? err.message : String(err),
        });
        send({ type: "error", message: "Server error during import" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
