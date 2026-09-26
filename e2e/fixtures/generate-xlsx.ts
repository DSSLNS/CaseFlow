/** Regenerates valid-import.xlsx. Run: npx tsx e2e/fixtures/generate-xlsx.ts */
import ExcelJS from "exceljs";
import path from "node:path";

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Test cases");
  ws.addRow(["Title", "Section", "Pre-conditions", "Step 1", "Expected 1", "Step 2", "Expected 2", "Priority", "Type", "Tags", "Estimate", "Owner"]);
  ws.addRow(["Export report as PDF IMPXLSX-1", "Imported XLSX > Reports", "Report data exists", "Open Reports", "Reports page loads", "Click Export PDF", "PDF downloads", "High", "Functional", "export, pdf", 20, "Sam Okafor"]);
  ws.addRow(["Ümlaut & <tag> in title IMPXLSX-2", "Imported XLSX > Reports", "", "Only one step", "It works", "", "", "Medium", "UI", "", "1h", ""]);
  // Rich text cell and a formula cell to exercise cell value conversion.
  const r = ws.addRow(["", "Imported XLSX", "", "Type 2+2", "", "", "", "Low", "Smoke", "math", "", "priya.sharma@example.com"]);
  r.getCell(1).value = { richText: [{ text: "Rich " }, { text: "text title IMPXLSX-3", font: { bold: true } }] };
  r.getCell(5).value = { formula: '"Shows "&(2+2)', result: "Shows 4" };
  await wb.xlsx.writeFile(path.join(__dirname, "valid-import.xlsx"));
  console.log("wrote valid-import.xlsx");
}
main();
