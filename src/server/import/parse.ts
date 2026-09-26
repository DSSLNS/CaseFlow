import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/constants";
import type { ParseResult, SourceRow } from "@/lib/import/types";
import { ServiceError } from "../services/errors";

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("error" in value) return String(value.error);
  }
  return String(value);
}

async function readXlsx(buf: Buffer): Promise<{ grid: string[][]; sheetName: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ServiceError("The file could not be read as an Excel workbook. Make sure it is a valid .xlsx file.");
  }
  const sheet = wb.worksheets.find((ws) => ws.actualRowCount > 0) ?? wb.worksheets[0];
  if (!sheet) throw new ServiceError("The workbook has no worksheets.");
  const grid: string[][] = [];
  const colCount = sheet.columnCount;
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c++) cells.push(cellToString(row.getCell(c).value));
    grid.push(cells);
  }
  return { grid, sheetName: sheet.name };
}

function readCsv(buf: Buffer): { grid: string[][]; errorsByRow: Map<number, string> } {
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const errorsByRow = new Map<number, string>();
  for (const e of result.errors) {
    if (e.row != null) errorsByRow.set(e.row, e.message);
  }
  // Papa emits a trailing empty row for files ending with a newline.
  const grid = result.data;
  while (grid.length && grid[grid.length - 1].every((c) => !c?.trim())) grid.pop();
  return { grid, errorsByRow };
}

export async function parseImportFile(file: File): Promise<ParseResult> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".xls")) {
    throw new ServiceError("Legacy .xls files are not supported. Open the file in Excel or Google Sheets and save it as .xlsx or .csv.");
  }
  const format = lower.endsWith(".csv") ? "csv" : lower.endsWith(".xlsx") ? "xlsx" : null;
  if (!format) throw new ServiceError("Unsupported file type. Upload a .csv or .xlsx file.");
  if (file.size === 0) throw new ServiceError("The file is empty.");
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new ServiceError(`The file is larger than ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buf).digest("hex");

  let grid: string[][];
  let sheetName: string | undefined;
  let errorsByRow = new Map<number, string>();
  if (format === "xlsx") {
    if (buf.subarray(0, 2).toString("latin1") !== "PK") {
      throw new ServiceError("The file does not look like a valid .xlsx workbook.");
    }
    ({ grid, sheetName } = await readXlsx(buf));
  } else {
    ({ grid, errorsByRow } = readCsv(buf));
  }

  const headerIndex = grid.findIndex((r) => r.some((c) => c?.trim()));
  if (headerIndex === -1) throw new ServiceError("No header row was found. The first non-empty row must contain column names.");

  const rawHeaders = grid[headerIndex].map((h) => (h ?? "").trim());
  // Trim trailing blank header cells that have no data underneath.
  let width = rawHeaders.length;
  while (width > 0 && !rawHeaders[width - 1] && grid.slice(headerIndex + 1).every((r) => !(r[width - 1] ?? "").trim())) width--;
  const headers = rawHeaders.slice(0, width).map((h, i) => h || `Column ${i + 1}`);

  const rows: SourceRow[] = [];
  const blankRows: number[] = [];
  const malformedRows: { rowNumber: number; reason: string }[] = [];

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const rowNumber = i + 1; // 1-based, as shown in spreadsheet apps
    const raw = grid[i].map((c) => c ?? "");
    if (raw.every((c) => !c.trim())) {
      blankRows.push(rowNumber);
      continue;
    }
    let issue: string | undefined = errorsByRow.get(i);
    const extra = raw.slice(width).filter((c) => c.trim());
    if (extra.length) {
      issue = `Row has ${raw.length} values but the header has ${width} columns; extra values would be lost.`;
    }
    const cells = raw.slice(0, width);
    while (cells.length < width) cells.push("");
    if (issue) malformedRows.push({ rowNumber, reason: issue });
    rows.push({ rowNumber, cells, issue });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ServiceError(`The file has ${rows.length} data rows; the limit is ${MAX_IMPORT_ROWS} per import.`);
  }

  return { filename: name, fileSize: file.size, fileHash, format, sheetName, headers, rows, blankRows, malformedRows };
}
