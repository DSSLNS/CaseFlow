import { authenticate, db, expect, test } from "./helpers";

// Captures key pages for the README. Runs last (file name) so it shows data created by other specs.
test("capture screenshots of key pages", async ({ page }) => {
  await authenticate(page);
  const shot = async (name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false });
  const run = await db.testRun.findFirstOrThrow({ where: { title: "Deploy 2.5.0 regression E2E" }, include: { cases: { orderBy: { position: "asc" } } } });
  await page.goto("/p/WEB/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await shot("01-dashboard");
  await page.goto("/p/WEB/cases");
  await shot("02-test-cases");
  await page.goto("/p/WEB/cases/new");
  await shot("03-test-case-form");
  await page.goto("/p/WEB/cases/WEB-1");
  await shot("04-test-case-view");
  await page.goto("/p/WEB/suites");
  await shot("05-suites");
  await page.goto("/p/WEB/import");
  await page.locator("#import-file").setInputFiles("e2e/fixtures/legacy-import.csv");
  await page.getByRole("button", { name: "Parse and preview" }).click();
  await page.getByRole("button", { name: "Continue to mapping" }).click();
  await shot("06-import-mapping");
  await page.getByRole("button", { name: "Ignore these columns" }).click();
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByRole("table", { name: "Validation results" })).toBeVisible();
  await shot("07-import-validation");
  await page.goto(`/p/WEB/runs/${run.id}?case=${run.cases[1].id}`);
  await expect(page.getByTestId("run-case-title")).toBeVisible();
  await shot("08-run-execution");
  await page.goto(`/p/WEB/runs/${run.id}/report`);
  await shot("09-run-report");
  await page.goto("/p/WEB/reports");
  await shot("10-reports");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/p/WEB/cases");
  await shot("11-mobile-cases");
});
