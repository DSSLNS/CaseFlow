import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { Page } from "@playwright/test";
import { authenticate, db, expect, expectToast, pick, projectId, test } from "./helpers";

const RUN_TITLE = "Deploy 2.5.0 regression E2E";

async function runRecord() {
  return db.testRun.findFirstOrThrow({
    where: { title: RUN_TITLE },
    include: {
      cases: {
        orderBy: { position: "asc" },
        include: { executions: { orderBy: { createdAt: "asc" }, include: { evidence: { orderBy: { createdAt: "asc" } } } } },
      },
    },
  });
}

async function selectCase(page: Page, index: number) {
  await page.getByTestId("run-case-item").nth(index).click();
  await expect(page.getByTestId("run-case-item").nth(index)).toHaveAttribute("aria-current", "true");
}

async function addEvidence(page: Page, i: number, kind: string, label: string, url: string) {
  await page.getByRole("button", { name: "Add evidence link" }).click();
  await pick(page, page.getByRole("combobox", { name: `Evidence ${i} type` }), kind);
  await page.getByRole("textbox", { name: `Evidence ${i} label` }).fill(label);
  await page.getByRole("textbox", { name: `Evidence ${i} URL` }).fill(url);
}

test.describe.serial("Regression runs and evidence", () => {
  test.beforeEach(async ({ page }) => { await authenticate(page); });

  test("start a regression run from a suite with deployment details", async ({ page }) => {
    const pid = await projectId();
    const loginCases = await db.testCase.count({ where: { projectId: pid, archived: false, suite: { name: "Login" } } });
    await page.goto("/p/WEB/runs/new");
    await page.getByRole("textbox", { name: "Run name" }).fill(RUN_TITLE);
    await page.getByRole("combobox", { name: "Environment" }).fill("Staging");
    await page.getByRole("textbox", { name: "Build / version" }).fill("2.5.0 (build 600)");
    await page.getByRole("textbox", { name: "Release / ticket" }).fill("REL-2.5");
    await page.getByLabel("Execution date").fill("2026-09-25");
    await pick(page, page.getByRole("combobox", { name: "Tester" }), "Sam Okafor");
    await page.getByRole("textbox", { name: "Notes" }).fill("Post-deploy regression");
    await page.getByLabel("Select suites").check();
    await page.getByRole("checkbox", { name: "Login" }).check();
    await expect(page.getByTestId("run-selected-count")).toHaveText(String(loginCases));
    await page.getByRole("button", { name: "Start test run" }).click();
    await expect(page).toHaveURL(/\/p\/WEB\/runs\/[a-z0-9]+$/);
    await expectToast(page, `Test run started with ${loginCases} case(s)`);
    const meta = page.getByTestId("run-meta");
    for (const v of ["Staging", "2.5.0 (build 600)", "REL-2.5", "Sep 25, 2026", "Sam Okafor", "Authentication > Login"]) await expect(meta).toContainText(v);
    await expect(page.getByTestId("run-case-item")).toHaveCount(loginCases);

    const run = await runRecord();
    expect([run.environment, run.buildVersion, run.releaseRef, run.description]).toEqual(["Staging", "2.5.0 (build 600)", "REL-2.5", "Post-deploy regression"]);
    expect(run.executionDate?.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(run.cases.every((c) => c.status === "Not Run")).toBe(true);
  });

  test("record Pass, Fail (defect + multiple evidence) and Blocked; results persist after reload", async ({ page }) => {
    const run0 = await runRecord();
    await page.goto(`/p/WEB/runs/${run0.id}`);
    await expect(page.getByText("Test case definition (reusable)")).toBeVisible();
    await expect(page.getByText("This run: result & evidence")).toBeVisible();

    await selectCase(page, 0);
    await page.getByRole("radio", { name: "Pass" }).click();
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, `Marked ${run0.cases[0].caseKey} as Pass`);

    await selectCase(page, 1);
    await page.getByRole("radio", { name: "Fail" }).click();
    await page.getByRole("textbox", { name: "Comment" }).fill("Error text missing; see recording");
    await page.getByRole("textbox", { name: "Defect reference" }).fill("BUG-777");
    // Invalid evidence is rejected before anything is saved.
    await addEvidence(page, 1, "Screenshot", "Error state", "not-a-url");
    await page.getByRole("button", { name: "Save result" }).click();
    await expect(page.getByText("Enter a full http(s) URL")).toBeVisible();
    expect(await db.testExecution.count({ where: { runCaseId: run0.cases[1].id } })).toBe(0);
    await page.getByRole("textbox", { name: "Evidence 1 URL" }).fill("https://drive.google.com/file/d/abc123/view");
    await addEvidence(page, 2, "Screen recording", "Full repro", "https://drive.google.com/file/d/rec456/view");
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, `Marked ${run0.cases[1].caseKey} as Fail`);

    await selectCase(page, 2);
    await page.getByRole("radio", { name: "Blocked" }).click();
    await page.getByRole("textbox", { name: "Comment" }).fill("Test account locked");
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, `Marked ${run0.cases[2].caseKey} as Blocked`);

    await page.reload();
    const counts = page.getByTestId("run-counts");
    await expect(counts).toContainText("1 Pass");
    await expect(counts).toContainText("1 Fail");
    await expect(counts).toContainText("1 Blocked");
    await selectCase(page, 1);
    const history = page.getByTestId("exec-history");
    await expect(history).toContainText("Defect: BUG-777");
    await expect(history.getByRole("link", { name: /Error state/ })).toHaveAttribute("href", "https://drive.google.com/file/d/abc123/view");
    await expect(history.getByRole("link", { name: /Full repro/ })).toHaveAttribute("target", "_blank");

    // Each execution is linked to the correct run and test case.
    const run = await runRecord();
    expect(run.cases.slice(0, 3).map((c) => c.status)).toEqual(["Pass", "Fail", "Blocked"]);
    for (const [i, c] of run.cases.slice(0, 3).entries()) {
      expect(c.executions).toHaveLength(1);
      expect(c.runId).toBe(run.id);
      expect(c.testCaseId).toBe(run0.cases[i].testCaseId);
    }
    const failed = run.cases[1].executions[0];
    expect(failed.bugRef).toBe("BUG-777");
    expect(failed.evidence.map((e) => [e.kind, e.label, e.url, e.provider])).toEqual([
      ["screenshot", "Error state", "https://drive.google.com/file/d/abc123/view", "url"],
      ["recording", "Full repro", "https://drive.google.com/file/d/rec456/view", "url"],
    ]);
    expect(run.cases[2].executions[0].evidence).toHaveLength(0); // missing evidence is allowed
  });

  test("re-running a case creates a new execution and preserves earlier evidence", async ({ page }) => {
    const run0 = await runRecord();
    await page.goto(`/p/WEB/runs/${run0.id}?case=${run0.cases[1].id}`);
    await page.getByRole("button", { name: /Copy 2 link\(s\) from latest execution/ }).click();
    await expect(page.getByTestId("evidence-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Remove evidence 1" }).click();
    await addEvidence(page, 2, "Log / report", "Fix verified", "https://ci.example.com/run/99");
    await page.getByRole("radio", { name: "Pass" }).click();
    await page.getByRole("textbox", { name: "Comment" }).fill("Fixed in build 601");
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, `Marked ${run0.cases[1].caseKey} as Pass`);
    await expect(page.getByTestId("exec-entry")).toHaveCount(2);

    const run = await runRecord();
    const execs = run.cases[1].executions;
    expect(execs).toHaveLength(2);
    expect(execs[0].status).toBe("Fail");
    expect(execs[0].evidence.map((e) => e.url)).toEqual(["https://drive.google.com/file/d/abc123/view", "https://drive.google.com/file/d/rec456/view"]);
    expect(execs[1].status).toBe("Pass");
    expect(execs[1].bugRef).toBe(""); // defect only applies to failures
    expect(execs[1].evidence.map((e) => e.url)).toEqual(["https://drive.google.com/file/d/rec456/view", "https://ci.example.com/run/99"]);
    expect(run.cases[1].status).toBe("Pass");
  });

  test("report and CSV/XLSX exports match the stored executions and evidence", async ({ page }) => {
    const run = await runRecord();
    await page.goto(`/p/WEB/runs/${run.id}/report`);
    await expect(page.getByTestId("report-count-total")).toHaveText(String(run.cases.length));
    await expect(page.getByTestId("report-count-Pass")).toHaveText("2");
    await expect(page.getByTestId("report-count-Fail")).toHaveText("0");
    await expect(page.getByTestId("report-count-Blocked")).toHaveText("1");
    await expect(page.getByTestId("report-count-Not Run")).toHaveText(String(run.cases.length - 3));
    await expect(page.getByTestId("report-row")).toHaveCount(run.cases.length);
    await expect(page.getByTestId("report-row").nth(1).getByRole("link", { name: /Fix verified/ })).toHaveAttribute("href", "https://ci.example.com/run/99");

    const latest = run.cases.map((c) => c.executions.at(-1));
    const csvRes = await page.request.get(`/api/runs/${run.id}/export?format=csv`);
    expect(csvRes.headers()["content-type"]).toContain("text/csv");
    const csv = Papa.parse<Record<string, string>>((await csvRes.text()).replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
    expect(csv.data).toHaveLength(run.cases.length);
    csv.data.forEach((row, i) => {
      const c = run.cases[i];
      const e = latest[i];
      expect(row["Run ID"]).toBe(run.id);
      expect(row["Test case ID"]).toBe(c.caseKey);
      expect(row["Scenario"]).toBe(c.title);
      expect(row["Result"]).toBe(c.status);
      expect(row["Notes"]).toBe(e?.comment ?? "");
      expect(row["Defect reference"]).toBe(e?.bugRef ?? "");
      expect(row["Evidence URLs"]).toBe((e?.evidence ?? []).map((v) => v.url).join("\n"));
      expect(row["Execution ID"]).toBe(e?.id ?? "");
      expect(row["Run case ID"]).toBe(c.id);
      expect(row["Environment"]).toBe("Staging");
    });

    const xRes = await page.request.get(`/api/runs/${run.id}/export?format=xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await xRes.body()) as unknown as ArrayBuffer);
    const results = wb.getWorksheet("Results")!;
    expect(results.actualRowCount).toBe(run.cases.length + 1);
    const hist = wb.getWorksheet("Execution history")!;
    const allExecs = run.cases.flatMap((c) => c.executions);
    expect(hist.actualRowCount).toBe(allExecs.length + 1);
    const header = (hist.getRow(1).values as string[]).slice(1);
    const col = (n: string) => header.indexOf(n) + 1;
    const firstFail = [...Array(hist.actualRowCount - 1).keys()].map((i) => hist.getRow(i + 2)).find((r) => r.getCell(col("Result")).text === "Fail")!;
    expect(firstFail.getCell(col("Evidence URLs")).text).toBe("https://drive.google.com/file/d/abc123/view\nhttps://drive.google.com/file/d/rec456/view");
    expect(firstFail.getCell(col("Attempt")).value).toBe(1);
    const summary = wb.getWorksheet("Summary")!;
    expect(summary.getCell("B11").value).toBe(run.cases.length);
  });

  test("completed runs are locked; reopening allows results; a new run never overwrites the old one", async ({ page }) => {
    const run = await runRecord();
    await page.goto(`/p/WEB/runs/${run.id}`);
    await page.getByRole("button", { name: "Complete run" }).click();
    await expectToast(page, "Run completed");
    await expect(page.getByText("This run is completed. Reopen it to record or change results.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save result" })).toBeDisabled();
    await page.getByRole("button", { name: "Reopen run" }).click();
    await expectToast(page, "Run reopened");
    await expect(page.getByRole("button", { name: "Save result" })).toBeEnabled();

    // Start a second run of the same suite and record a different result.
    await page.goto("/p/WEB/runs/new");
    await page.getByRole("textbox", { name: "Run name" }).fill("Deploy 2.5.1 regression E2E");
    await page.getByLabel("Select suites").check();
    await page.getByRole("checkbox", { name: "Login" }).check();
    await page.getByRole("button", { name: "Start test run" }).click();
    await expect(page.getByTestId("run-case-item").first()).toBeVisible();
    await page.getByRole("radio", { name: "Fail" }).click();
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, /as Fail/);

    const first = await runRecord();
    expect(first.cases[0].status).toBe("Pass");
    expect(first.cases[0].executions).toHaveLength(1);
    const second = await db.testRun.findFirstOrThrow({ where: { title: "Deploy 2.5.1 regression E2E" }, include: { cases: { orderBy: { position: "asc" } } } });
    expect(second.cases[0].status).toBe("Fail");
    expect(second.cases[0].testCaseId).toBe(first.cases[0].testCaseId);
  });

  test("editing a test case after a run does not rewrite the run's snapshot", async ({ page }) => {
    const run = await runRecord();
    const c = run.cases[0];
    await db.testCase.update({ where: { id: c.testCaseId! }, data: { title: "Renamed after run E2E" } });
    await page.goto(`/p/WEB/runs/${run.id}?case=${c.id}`);
    await expect(page.getByTestId("run-case-title")).toHaveText(c.title);
    await db.testCase.update({ where: { id: c.testCaseId! }, data: { title: c.title } });
  });

  test("seeded failed result shows its evidence link on the report", async ({ page }) => {
    const seeded = await db.testRun.findFirstOrThrow({ where: { title: "Release 2.3 Regression" } });
    await page.goto(`/p/WEB/runs/${seeded.id}/report`);
    await expect(page.getByRole("link", { name: /Missing error message/ })).toHaveAttribute("href", "https://example.com/evidence/bug-1042.png");
  });
});
