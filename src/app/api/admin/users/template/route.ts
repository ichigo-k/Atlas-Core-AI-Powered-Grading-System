import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

const VALID_ROLES = ["STUDENT", "LECTURER", "ADMIN"] as const;
const VALID_TITLES = ["Dr.", "Prof.", "Mr.", "Mrs.", "Ms."] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const role = request.nextUrl.searchParams.get("role");
  if (!role || !VALID_ROLES.includes(role as ValidRole)) {
    return new Response(JSON.stringify({ error: "role must be one of STUDENT, LECTURER, ADMIN" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Users");

  if (role === "STUDENT") {
    sheet.addRow(["email", "name", "indexNumber", "program", "class"]);

    const programs = await prisma.program.findMany({
      orderBy: [{ name: "asc" }],
      include: { faculty: { select: { name: true } } },
    });
    const classes = await prisma.class.findMany({
      where: { isGraduated: false },
      orderBy: [{ level: "asc" }, { name: "asc" }]
    });

    const programNames = programs.map((program) => program.name);
    const classNames = classes.map(c => `${c.name} - Level ${c.level}`);

    if (programNames.length > 0 || classNames.length > 0) {
      const dataSheet = workbook.addWorksheet("Data", { state: "hidden" });
      programNames.forEach((name, idx) => {
        dataSheet.getCell(`A${idx + 1}`).value = name;
      });
      classNames.forEach((name, idx) => {
        dataSheet.getCell(`B${idx + 1}`).value = name;
      });

      for (let i = 2; i <= 500; i++) {
        if (programNames.length > 0) {
          sheet.getCell(`D${i}`).dataValidation = {
            type: "list",
            allowBlank: false,
            showErrorMessage: true,
            errorTitle: "Invalid program",
            error: "Select a program from the dropdown list.",
            formulae: [`Data!$A$1:$A$${programNames.length}`]
          };
        }
        if (classNames.length > 0) {
          sheet.getCell(`E${i}`).dataValidation = {
            type: "list",
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: "Invalid class",
            error: "Select a class from the dropdown list.",
            formulae: [`Data!$B$1:$B$${classNames.length}`]
          };
        }
      }
    }

  } else if (role === "LECTURER") {
    sheet.addRow(["email", "name", "faculty", "title"]);

    const faculties = await prisma.faculty.findMany({
      orderBy: { name: "asc" },
    });
    const facultyNames = faculties.map((faculty) => faculty.name);

    if (facultyNames.length > 0 || VALID_TITLES.length > 0) {
      const dataSheet = workbook.addWorksheet("Data", { state: "hidden" });
      facultyNames.forEach((name, idx) => {
        dataSheet.getCell(`A${idx + 1}`).value = name;
      });
      VALID_TITLES.forEach((title, idx) => {
        dataSheet.getCell(`B${idx + 1}`).value = title;
      });

      for (let i = 2; i <= 500; i++) {
        sheet.getCell(`C${i}`).dataValidation = {
          type: "list",
          allowBlank: false,
          showErrorMessage: true,
          errorTitle: "Invalid faculty",
          error: "Select a faculty from the dropdown list.",
          formulae: [`Data!$A$1:$A$${facultyNames.length}`]
        };
        sheet.getCell(`D${i}`).dataValidation = {
          type: "list",
          allowBlank: false,
          showErrorMessage: true,
          errorTitle: "Invalid title",
          error: "Select a title from the dropdown list.",
          formulae: [`Data!$B$1:$B$${VALID_TITLES.length}`]
        };
      }
    }
  } else if (role === "ADMIN") {
    sheet.addRow(["email", "name"]);
  }

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002388" } };
  sheet.columns.forEach(col => { col.width = 30; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as BlobPart, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="user-template-${role.toLowerCase()}.xlsx"`,
    },
  });
}
