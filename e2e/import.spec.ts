import path from "node:path";
import type { Page } from "@playwright/test";
import { authenticate, db, expect, pick, projectId, test } from "./helpers";

const fixture = (f: string) => path.join(__dirname, "fixtures", f);

async function upload(page: Page, file: string) {
  await page.goto("/p/WEB/import");
  await page.locator("#import-file").setInputFiles(fixture(file));
  await expect(page.getByTestId("selected-file")).toContainText(file);
  await page.getByRole("button", { name: "Parse and preview" }).click();
  await expect(page.getByRole("table", { name: "File preview" })).toBeVisible();
}

async function toValidation(page: Page, defaultSuite?: string | RegExp) {
  await page.getByRole("button", { name: "Continue to mapping" }).click();
  if (defaultSuite) await pick(page, page.getByRole("combobox", { name: "Default suite" }), defaultSuite);
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByRole("table", { name: "Validation results" })).toBeVisible();
}

async function confirm(page: Page) {
  await page.getByRole("button", { name: "Review summary" }).click();
  await page.getByRole("button", { name: /^Confirm import/ }).click();
  await expect(page.getByTestId("import-result")).toBeVisible();
}

async function caseByTitle(title: string) {
  return db.testCase.findFirstOrThrow({
    where: { title, project: { code: "WEB" } },
    include: { steps: { orderBy: { position: "asc" } }, tags: { include: { tag: true } }, suite: { include: { parent: true } }, assignee: true },
  });
}

test.describe("Import test cases", () => {
  test.beforeEach(async ({ page }) => { await authenticate(page); });

  test("imports a valid CSV and every mapped field matches the source", async ({ page }) => {
    const pid = await projectId();
    const before = await db.testCase.count({ where: { projectId: pid } });
    await upload(page, "valid-import.csv");
    await expect(page.getByTestId("preview-rows")).toHaveText("4");
    await expect(page.getByTestId("preview-blank")).toHaveText("0");
    await toValidation(page, "Search");
    await expect(page.getByTestId("val-total")).toHaveText("4");
    await expect(page.getByTestId("val-valid")).toHaveText("4");
    await expect(page.getByTestId("val-invalid")).toHaveText("0");
    await page.getByRole("button", { name: "Review summary" }).click();
    await expect(page.getByTestId("plan-create")).toHaveText("4");
    await page.getByRole("button", { name: "Confirm import (4 test cases)" }).click();
    await expect(page.getByTestId("result-created")).toHaveText("4");
    await expect(page.getByTestId("result-failed")).toHaveText("0");
    expect(await db.testCase.count({ where: { projectId: pid } })).toBe(before + 4);

    const a = await caseByTitle(`Refund, partial "amount" — €10 IMPCSV-1`);
    expect(a.suite.name).toBe("Billing");
    expect(a.suite.parent?.name).toBe("Imported CSV");
    expect(a.preconditions).toBe("Order exists\nPayment captured");
    expect(a.description).toBe("Verifies partial refunds, including quotes & commas.");
    expect(a.steps.map((s) => [s.action, s.expectedResult])).toEqual([
      ["Open the order", "Order details shown"],
      [`Click "Refund"`, "Refund dialog opens"],
      ["Enter 10.00 and confirm", "Refund of €10 is recorded"],
    ]);
    expect([a.priority, a.status, a.type, a.severity]).toEqual(["High", "Ready", "Regression", "Major"]);
    expect(a.assignee?.email).toBe("alex.chen@example.com");
    expect(a.tags.map((t) => t.tag.name).sort()).toEqual(["billing", "refunds"]);
    expect(a.estimateMinutes).toBe(90);
    expect(a.automationStatus).toBe("Automated");
    expect(a.automationRef).toBe("https://ci.example.com/tests/123");

    const b = await caseByTitle("Überprüfung der Umlaute ✓ IMPCSV-2");
    expect(b.suite.name).toBe("Billing");
    expect(b.steps.map((s) => [s.action, s.expectedResult])).toEqual([["Enter the name Jürgen Groß", "Name is stored and displayed exactly"]]);
    expect([b.priority, b.status, b.type, b.severity, b.automationStatus]).toEqual(["Low", "Draft", "API", "Minor", "To Automate"]);
    expect(b.assignee?.name).toBe("Maria Garcia");
    expect(b.estimateMinutes).toBe(45);

    const c = await caseByTitle(`<script>alert("x")</script> is escaped IMPCSV-3`);
    expect(c.suite.name).toBe("Imported CSV");
    expect(c.suite.parentId).toBeNull();
    expect(c.steps).toHaveLength(0);
    expect([c.priority, c.status, c.type, c.automationStatus, c.estimateMinutes]).toEqual(["Critical", "Deprecated", "Security", "Not Automated", 120]);

    const d = await caseByTitle("Defaults applied IMPCSV-4");
    expect(d.suite.name).toBe("Search");
    expect([d.priority, d.status, d.type, d.automationStatus, d.severity, d.assigneeId]).toEqual(["Medium", "Draft", "Functional", "Not Automated", null, null]);

    // The special-character title renders as text, not markup.
    await page.goto(`/p/WEB/cases/WEB-${c.number}`);
    await expect(page.getByTestId("case-title")).toHaveText(`<script>alert("x")</script> is escaped IMPCSV-3`);

    // Import history and row details agree with the database.
    await page.goto("/p/WEB/import");
    const row = page.getByTestId("import-history-row").filter({ hasText: "valid-import.csv" }).first();
    await expect(row).toContainText("Completed");
    await row.getByRole("link").click();
    await expect(page.getByTestId("batch-created")).toHaveText("4");
    await expect(page.getByTestId("batch-row")).toHaveCount(4);
  });

  test("imports a valid XLSX with multiple step columns, rich text and formulas", async ({ page }) => {
    await upload(page, "valid-import.xlsx");
    await expect(page.getByTestId("preview-rows")).toHaveText("3");
    await page.getByRole("button", { name: "Continue to mapping" }).click();
    // Step/Expected columns are auto-mapped as multi-column steps.
    await expect(page.getByRole("combobox", { name: "Import column Step 2 as" })).toContainText("Steps");
    await expect(page.getByRole("combobox", { name: "Import column Expected 2 as" })).toContainText("Expected Result");
    await expect(page.getByRole("combobox", { name: "Import column Section as" })).toContainText("Suite");
    await page.getByRole("button", { name: "Validate rows" }).click();
    await expect(page.getByTestId("val-valid")).toHaveText("3");
    await confirm(page);
    await expect(page.getByTestId("result-created")).toHaveText("3");

    const a = await caseByTitle("Export report as PDF IMPXLSX-1");
    expect(a.suite.name).toBe("Reports");
    expect(a.suite.parent?.name).toBe("Imported XLSX");
    expect(a.preconditions).toBe("Report data exists");
    expect(a.steps.map((s) => [s.action, s.expectedResult])).toEqual([
      ["Open Reports", "Reports page loads"],
      ["Click Export PDF", "PDF downloads"],
    ]);
    expect(a.estimateMinutes).toBe(20);
    expect(a.assignee?.name).toBe("Sam Okafor");
    expect(a.tags.map((t) => t.tag.name).sort()).toEqual(["export", "pdf"]);
    const b = await caseByTitle("Ümlaut & <tag> in title IMPXLSX-2");
    expect(b.steps).toHaveLength(1);
    expect([b.type, b.estimateMinutes]).toEqual(["UI", 60]);
    const c = await caseByTitle("Rich text title IMPXLSX-3");
    expect(c.suite.name).toBe("Imported XLSX");
    expect(c.steps.map((s) => [s.action, s.expectedResult])).toEqual([["Type 2+2", "Shows 4"]]);
    expect(c.assignee?.email).toBe("priya.sharma@example.com");
  });

  test("legacy headers: preview detects blank/malformed rows, mapping flags unmapped columns, rows can be corrected", async ({ page }) => {
    await upload(page, "legacy-import.csv");
    await expect(page.getByTestId("preview-rows")).toHaveText("4");
    await expect(page.getByTestId("preview-blank")).toHaveText("2");
    await expect(page.getByTestId("preview-malformed")).toHaveText("1");
    await expect(page.getByText("Row 6: Row has 11 values but the header has 10 columns")).toBeVisible();

    await page.getByRole("button", { name: "Continue to mapping" }).click();
    const expectMap = async (col: string, field: string) =>
      expect(page.getByRole("combobox", { name: `Import column ${col} as` })).toContainText(field);
    await expectMap("Test Case Name", "Title");
    await expectMap("Module", "Suite");
    await expectMap("Pre-requisites", "Preconditions");
    await expectMap("Test Steps", "Steps");
    await expectMap("Expected Outcome", "Expected Result");
    await expectMap("Prio", "Priority");
    await expectMap("Automated", "Automation Status");
    await expectMap("Labels", "Tags");
    await expect(page.getByRole("alert").filter({ hasText: "2 column(s) are not mapped" })).toContainText("Legacy ID, Reviewer Notes");
    await expect(page.getByRole("button", { name: "Validate rows" })).toBeDisabled();

    // Manual mapping plus an explicit decision for the rest.
    await pick(page, page.getByRole("combobox", { name: "Import column Reviewer Notes as" }), "Description");
    await page.getByRole("button", { name: "Ignore these columns" }).click();
    await expectMap("Legacy ID", "Don't import this column");
    await expect(page.getByText("Not imported: Legacy ID.")).toBeVisible();
    await page.getByRole("button", { name: "Validate rows" }).click();

    await expect(page.getByTestId("val-valid")).toHaveText("1");
    await expect(page.getByTestId("val-invalid")).toHaveText("3");
    const table = page.getByRole("table", { name: "Validation results" });
    await expect(table).toContainText("Found 3 step(s) but 1 expected result(s); cannot pair them safely");
    await expect(table).toContainText("extra values would be lost");
    await expect(table).toContainText('"P1" is not a valid priority');

    // Correct row 7 in place and re-validate.
    await page.getByRole("button", { name: "Edit row 7" }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: /Priority/ }).fill("High");
    await page.getByRole("button", { name: "Save and re-validate" }).click();
    await expect(page.getByTestId("val-valid")).toHaveText("2");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download validation report" }).click();
    expect((await download).suggestedFilename()).toBe("legacy-import-validation-report.csv");

    await confirm(page);
    await expect(page.getByTestId("result-created")).toHaveText("2");
    await expect(page.getByTestId("result-failed")).toHaveText("2");

    const leg1 = await caseByTitle("Legacy login works LEG-1");
    expect(leg1.suite.name).toBe("Auth");
    expect(leg1.suite.parent?.name).toBe("Legacy");
    expect(leg1.description).toBe("ok");
    expect(leg1.preconditions).toBe("User exists");
    expect(leg1.automationStatus).toBe("Automated");
    expect(leg1.steps.map((s) => [s.action, s.expectedResult])).toEqual([
      ["Open app", "App opens"],
      ["Log in", "Dashboard shown"],
    ]);
    expect((await caseByTitle("Legacy search LEG-4")).priority).toBe("High");
    expect(await db.testCase.count({ where: { title: { in: ["Legacy mismatched steps LEG-2", "Legacy extra column LEG-3"] } } })).toBe(0);
    const batch = await db.importBatch.findFirstOrThrow({ where: { filename: "legacy-import.csv" }, include: { rows: true } });
    expect(batch.rows.map((r) => [r.rowNumber, r.outcome]).sort()).toEqual([
      [2, "created"],
      [4, "failed"],
      [6, "failed"],
      [7, "created"],
    ]);
    expect(batch.totalRows).toBe(6); // 4 data rows + 2 blank rows
  });

  test("rows with missing or invalid required values are reported and not imported", async ({ page }) => {
    await upload(page, "missing-required.csv");
    await page.getByRole("button", { name: "Continue to mapping" }).click();
    await page.getByRole("checkbox", { name: /Create suites that don/ }).uncheck();
    await page.getByRole("button", { name: "Validate rows" }).click();
    await expect(page.getByTestId("val-valid")).toHaveText("1");
    await expect(page.getByTestId("val-invalid")).toHaveText("5");
    await page.getByRole("button", { name: /^Errors/ }).click();
    const table = page.getByRole("table", { name: "Validation results" });
    await expect(page.getByTestId("validation-row")).toHaveCount(5);
    for (const msg of ["Title is required.", '"Urgent" is not a valid priority', 'No user matches "nobody@example.com"', '"soon" is not a valid estimate', 'Unknown suite "Does Not Exist"']) {
      await expect(table).toContainText(msg);
    }
    await confirm(page);
    await expect(page.getByTestId("result-created")).toHaveText("1");
    await expect(page.getByTestId("result-failed")).toHaveText("5");
    expect(await db.testCase.count({ where: { title: { contains: "MISS-" } } })).toBe(1);
    expect(await db.suite.count({ where: { name: "Does Not Exist" } })).toBe(0);
    await page.getByRole("link", { name: "View row details" }).click();
    await expect(page.getByTestId("batch-row").filter({ hasText: "failed" })).toHaveCount(5);
    await expect(page.getByRole("table", { name: "Row results" })).toContainText('"Urgent" is not a valid priority');
  });

  test("importing the same file twice is detected; skip creates nothing and update changes existing cases", async ({ page }) => {
    const titles = (await db.testCase.findMany({ where: { title: { contains: "IMPCSV-" } } })).map((c) => c.title);
    expect(titles).toHaveLength(4); // imported by the first test
    const before = await db.testCase.count();
    await upload(page, "valid-import.csv");
    await toValidation(page, "Search");
    await expect(page.getByTestId("previous-import-warning")).toBeVisible();
    await expect(page.getByTestId("val-duplicates")).toHaveText("4");
    await page.getByRole("button", { name: "Review summary" }).click();
    await expect(page.getByTestId("plan-create")).toHaveText("0");
    await expect(page.getByTestId("plan-skip")).toHaveText("4");
    await expect(page.getByRole("button", { name: /^Confirm import/ })).toBeDisabled();

    await page.getByRole("button", { name: "Back" }).click();
    await pick(page, page.getByRole("combobox", { name: /For rows matching existing/ }), "Update existing case with file values");
    await page.getByRole("combobox", { name: "Action for row 5" }).click();
    await page.getByRole("option", { name: "Skip" }).click();
    await page.getByRole("button", { name: "Review summary" }).click();
    await expect(page.getByTestId("plan-update")).toHaveText("3");
    await expect(page.getByTestId("plan-skip")).toHaveText("1");
    await page.getByRole("button", { name: /^Confirm import/ }).click();
    await expect(page.getByTestId("result-updated")).toHaveText("3");
    await expect(page.getByTestId("result-created")).toHaveText("0");
    await expect(page.getByTestId("result-skipped")).toHaveText("1");
    expect(await db.testCase.count()).toBe(before);
    for (const t of titles) expect(await db.testCase.count({ where: { title: t } })).toBe(1);
  });

  test("submitting the same import request twice imports once (idempotent)", async ({ page }) => {
    const pid = await projectId();
    const suite = await db.suite.findFirstOrThrow({ where: { projectId: pid, name: "Search" } });
    const csv = "Title,Steps\nIdempotent import IDEM-1,Do it\n";
    const parsed = await (
      await page.request.post("/api/import/parse", { multipart: { file: { name: "idem.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } } })
    ).json();
    const body = {
      projectId: pid,
      headers: parsed.headers,
      rows: parsed.rows,
      mapping: ["title", "steps"],
      options: { defaultSuiteId: suite.id, createMissingSuites: false, duplicateStrategy: "project_title" },
      fileHash: parsed.fileHash,
      idempotencyKey: `e2e-${Date.now()}`,
      filename: "idem.csv",
      fileSize: parsed.fileSize,
      blankRows: 0,
      defaultDuplicateAction: "create",
      rowActions: {},
    };
    const [r1, r2] = await Promise.all([
      page.request.post("/api/import/commit", { data: body }),
      page.request.post("/api/import/commit", { data: body }),
    ]);
    const results = [await r1.json(), await r2.json()];
    expect(results.filter((r) => r.replayed === false)).toHaveLength(1);
    expect(results.every((r) => r.created === 1)).toBe(true);
    expect(results[0].batchId).toBe(results[1].batchId);
    const r3 = await (await page.request.post("/api/import/commit", { data: body })).json();
    expect(r3.replayed).toBe(true);
    expect(await db.testCase.count({ where: { title: "Idempotent import IDEM-1" } })).toBe(1);
  });

  test("rejects unsupported files with a clear message", async ({ page }) => {
    await page.goto("/p/WEB/import");
    await page.locator("#import-file").setInputFiles({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("x") });
    await expect(page.getByRole("alert").filter({ hasText: "Legacy .xls" })).toContainText("Legacy .xls is not supported");
    await expect(page.getByRole("button", { name: "Parse and preview" })).toBeDisabled();
    const res = await page.request.post("/api/import/parse", { multipart: { file: { name: "fake.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not a zip") } } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("valid .xlsx");
  });
});
