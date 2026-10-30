import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { buildReport } from "@/lib/queries";

type Report = Awaited<ReturnType<typeof buildReport>>;

function stamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export async function buildExcel(report: Report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HT Impact Manager";
  workbook.company = "HT Digital Solutions";
  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["HT Impact Manager"]);
  summary.addRow(["HT Digital Solutions"]);
  summary.addRow(["Generated", stamp()]);
  summary.addRow([]);
  summary.addRow(["Code", "Project", "Type", "Status", "Progress", "Beneficiaries", "Sessions", "Activities"]);
  for (const project of report.projects) {
    summary.addRow([
      project.code,
      project.name,
      project.type,
      project.status,
      `${project.progress}%`,
      project.beneficiaries.length,
      project.sessions.length,
      project.activities.length,
    ]);
  }
  summary.getRow(5).font = { bold: true };

  const people = workbook.addWorksheet("Beneficiaries");
  people.addRow(["Project", "Code", "Name", "Gender", "Community", "Status"]);
  people.getRow(1).font = { bold: true };
  for (const project of report.projects) {
    for (const person of project.beneficiaries) {
      people.addRow([project.code, person.code, person.name, person.gender, person.community ?? "", person.status]);
    }
  }

  const attendance = workbook.addWorksheet("Attendance");
  attendance.addRow(["Project", "Course", "Cohort", "Session", "When", "Present", "Absent", "Late", "Excused", "Rate"]);
  attendance.getRow(1).font = { bold: true };
  for (const project of report.projects) {
    for (const session of project.sessions) {
      attendance.addRow([
        project.code,
        session.course,
        session.cohort,
        session.title,
        session.when,
        session.PRESENT,
        session.ABSENT,
        session.LATE,
        session.EXCUSED,
        `${session.rate}%`,
      ]);
    }
  }

  const activities = workbook.addWorksheet("Activities");
  activities.addRow(["Project", "Activity", "When", "Participated", "Logged"]);
  activities.getRow(1).font = { bold: true };
  for (const project of report.projects) {
    for (const activity of project.activities) {
      activities.addRow([project.code, activity.name, activity.when ?? "", activity.participated, activity.total]);
    }
  }

  for (const sheet of workbook.worksheets) {
    sheet.columns.forEach((column) => {
      column.width = 24;
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function pdfText(value: string, unicode: boolean) {
  if (unicode) return value;
  return value.replace(/[^\x00-\xFF]/g, "?");
}

export async function buildPdf(report: Report) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("HT Impact Manager report");
  pdf.setAuthor("HT Digital Solutions");
  let font = await pdf.embedFont(StandardFonts.Helvetica);
  let unicode = false;
  try {
    const bytes = await readFile(path.join(process.cwd(), "assets/fonts/NotoSansArabic-Regular.ttf"));
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(bytes, { subset: true });
    unicode = true;
  } catch {
    unicode = false;
  }

  let page = pdf.addPage([595, 842]);
  let y = 800;
  const write = (text: string, size = 11, color = rgb(0.07, 0.16, 0.28)) => {
    if (y < 50) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(pdfText(text, unicode).slice(0, 110), { x: 40, y, size, font, color });
    y -= size + 8;
  };

  write("HT Impact Manager", 20);
  write("HT Digital Solutions", 12, rgb(0.06, 0.46, 0.43));
  write(`Generated ${stamp()}`, 10, rgb(0.36, 0.42, 0.5));
  y -= 8;
  for (const project of report.projects) {
    write(`${project.code}  ${project.name}`, 14);
    write(`${project.type} · ${project.status} · ${project.progress}%`);
    for (const metric of project.metrics) {
      write(`${metric.label}: ${metric.actual} / ${metric.target} ${metric.unit}`, 10);
    }
    write(`Beneficiaries: ${project.beneficiaries.length}`, 10);
    for (const session of project.sessions) {
      write(
        `${session.title}: P ${session.PRESENT} A ${session.ABSENT} L ${session.LATE} E ${session.EXCUSED} (${session.rate}%)`,
        10,
      );
    }
    for (const activity of project.activities) {
      write(`${activity.name}: ${activity.participated}/${activity.total}`, 10);
    }
    y -= 6;
  }
  return Buffer.from(await pdf.save());
}
