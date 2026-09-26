import ExcelJS from "exceljs";
import Papa from "papaparse";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildRunReport, type ReportRow, type RunReport } from "@/server/services/run-report";

/** Prevents spreadsheet formula injection from user-entered text. */
function safe(v: string) {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const COLUMNS = [
  "Run ID",
  "Run",
  "Environment",
  "Build / version",
  "Release / ticket",
  "Test case ID",
  "Scenario",
  "Suite",
  "Result",
  "Tester",
  "Executed at (UTC)",
  "Notes",
  "Defect reference",
  "Evidence URLs",
  "Evidence labels",
  "Run case ID",
  "Execution ID",
];

function toCells(report: RunReport, r: ReportRow): string[] {
  const { run } = report;
  return [
    run.id,
    run.title,
    run.environment,
    run.buildVersion,
    run.releaseRef,
    r.caseKey,
    r.scenario,
    r.suite,
    r.result,
    r.tester,
    r.executedAt,
    r.notes,
    r.defect,
    r.evidence.map((e) => e.url).join("\n"),
    r.evidence.map((e) => e.label || e.kind).join("\n"),
    r.runCaseId,
    r.executionId,
  ].map(safe);
}

export async function GET(request: Request, ctx: RouteContext<"/api/runs/[runId]/export">) {
  const { runId } = await ctx.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const project = await db.testRun.findUnique({ where: { id: runId }, select: { projectId: true } });
  if (!project) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const report = await buildRunReport(project.projectId, runId);
  if (!report) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const base = `${report.run.project.code}-run-${report.run.title}`.replace(/[^\w.-]+/g, "_").slice(0, 80);

  if (format === "csv") {
    const csv = Papa.unparse({ fields: COLUMNS, data: report.rows.map((r) => toCells(report, r)) });
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet("Summary");
    const { run, counts } = report;
    summary.addRows([
      ["Run", run.title],
      ["Run ID", run.id],
      ["Project", run.project.name],
      ["Environment", run.environment],
      ["Build / version", run.buildVersion],
      ["Release / ticket", run.releaseRef],
      ["Execution date", run.executionDate ? run.executionDate.toISOString().slice(0, 10) : ""],
      ["Tester", run.owner?.name ?? ""],
      ["Status", run.status],
      [],
      ["Total", counts.total],
      ["Pass", counts.Pass],
      ["Fail", counts.Fail],
      ["Blocked", counts.Blocked],
      ["Not Run", counts["Not Run"]],
    ].map((r) => r.map((c) => (typeof c === "string" ? safe(c) : c))));
    summary.getColumn(1).font = { bold: true };
    summary.getColumn(1).width = 18;
    summary.getColumn(2).width = 50;

    for (const [name, list] of [
      ["Results", report.rows],
      ["Execution history", report.history],
    ] as const) {
      const ws = wb.addWorksheet(name);
      const cols = name === "Results" ? COLUMNS : [...COLUMNS, "Attempt"];
      ws.addRow(cols).font = { bold: true };
      for (const r of list) {
        const cells: (string | number)[] = toCells(report, r);
        if ("attempt" in r) cells.push(r.attempt);
        ws.addRow(cells).alignment = { wrapText: true, vertical: "top" };
      }
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.columns.forEach((c) => (c.width = 18));
    }
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }
  return NextResponse.json({ error: 'Use format=csv or format=xlsx.' }, { status: 400 });
}
