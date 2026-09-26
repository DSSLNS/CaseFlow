import { authenticate, db, expect, expectToast, pick, projectId, test } from "./helpers";

const LIST = "/p/WEB/cases";

async function rowTitles(page: import("@playwright/test").Page) {
  return page.getByTestId("case-row").locator("td:nth-child(3)").allInnerTexts();
}

test.describe("Test case list", () => {
  test.beforeEach(async ({ page }) => { await authenticate(page); });

  test("search by title and by ID", async ({ page }) => {
    await page.goto(LIST);
    const search = page.getByRole("searchbox", { name: "Search by ID or title" });
    await search.fill("password reset email");
    await expect(page).toHaveURL(/q=password/);
    await expect(page.getByTestId("case-row")).toHaveCount(1);
    await expect(page.getByTestId("case-row")).toContainText("Request password reset email");

    const target = await db.testCase.findFirstOrThrow({ where: { title: "Pay with a valid credit card" } });
    await search.fill(`WEB-${target.number}`);
    await search.press("Enter");
    await expect(page.getByTestId("case-row")).toHaveCount(1);
    await expect(page.getByTestId("case-row")).toContainText("Pay with a valid credit card");

    await search.fill("zzz-no-such-case");
    await search.press("Enter");
    await expect(page.getByText("No test cases match your filters")).toBeVisible();
  });

  test("filter by suite (including sub-suites), priority and status match the database", async ({ page }) => {
    const pid = await projectId();
    await page.goto(LIST);
    await pick(page, page.getByRole("combobox").filter({ hasText: "All suites" }), /^Checkout\b/);
    await expect(page).toHaveURL(/suite=/);
    const checkoutCount = await db.testCase.count({ where: { projectId: pid, archived: false, suite: { OR: [{ name: "Checkout" }, { parent: { name: "Checkout" } }] } } });
    await expect(page.getByTestId("case-row")).toHaveCount(checkoutCount);

    await pick(page, page.getByRole("combobox", { name: "Filter by priorities" }), "Critical");
    const critical = await db.testCase.count({
      where: { projectId: pid, archived: false, priority: "Critical", suite: { OR: [{ name: "Checkout" }, { parent: { name: "Checkout" } }] } },
    });
    await expect(page.getByTestId("case-row")).toHaveCount(critical);
    for (const row of await page.getByTestId("case-row").all()) await expect(row).toContainText("Critical");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await pick(page, page.getByRole("combobox", { name: "Filter by statuses" }), "Deprecated");
    const deprecated = await db.testCase.count({ where: { projectId: pid, archived: false, status: "Deprecated" } });
    await expect(page.getByTestId("case-row")).toHaveCount(deprecated);
    for (const row of await page.getByTestId("case-row").all()) await expect(row).toContainText("Deprecated");
  });

  test("sorting by title and pagination work on the current dataset", async ({ page }) => {
    const pid = await projectId();
    const total = await db.testCase.count({ where: { projectId: pid, archived: false } });
    await page.goto(`${LIST}?size=10`);
    await expect(page.getByTestId("pagination-summary")).toHaveText(`1–10 of ${total}`);
    await page.getByRole("button", { name: /^Sort by Title/ }).click();
    await expect(page).toHaveURL(/sort=title&dir=asc/);
    const titles = await rowTitles(page);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
    const expectedFirst = await db.testCase.findMany({ where: { projectId: pid, archived: false }, orderBy: { title: "asc" }, take: 10 });
    expect(titles).toEqual(expectedFirst.map((c) => c.title));

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("pagination-summary")).toHaveText(`11–${Math.min(20, total)} of ${total}`);
    const page2 = await rowTitles(page);
    expect(page2.some((t) => titles.includes(t))).toBe(false);

    await page.getByRole("button", { name: /^Sort by Priority/ }).click();
    await page.getByRole("button", { name: /^Sort by Priority/ }).click();
    await expect(page).toHaveURL(/sort=priority&dir=desc/);
    await expect(page.getByTestId("case-row").first()).toContainText("Critical");
  });

  test("duplicate creates a distinct record", async ({ page }) => {
    const pid = await projectId();
    const src = await db.testCase.findFirstOrThrow({ where: { title: "Update item quantity in cart" }, include: { steps: true, tags: true } });
    const before = await db.testCase.count({ where: { projectId: pid } });
    await page.goto(`${LIST}?q=Update item quantity`);
    await page.getByRole("button", { name: `Actions for WEB-${src.number}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expectToast(page, /Duplicated as WEB-\d+/);
    const copy = await db.testCase.findFirstOrThrow({ where: { title: "Update item quantity in cart (copy)" }, include: { steps: true, tags: true } });
    expect(copy.id).not.toBe(src.id);
    expect(copy.number).not.toBe(src.number);
    expect(copy.status).toBe("Draft");
    expect(copy.steps.length).toBe(src.steps.length);
    expect(copy.tags.length).toBe(src.tags.length);
    expect(await db.testCase.count({ where: { projectId: pid } })).toBe(before + 1);
    await expect(page.getByTestId("case-row")).toHaveCount(2);
  });

  test("delete asks for confirmation; cancel keeps it, confirm removes it", async ({ page }) => {
    const pid = await projectId();
    const p = await db.project.update({ where: { id: pid }, data: { caseCounter: { increment: 1 } } });
    const suite = await db.suite.findFirstOrThrow({ where: { projectId: pid, name: "Search" } });
    const tc = await db.testCase.create({ data: { projectId: pid, suiteId: suite.id, number: p.caseCounter, title: "Delete me E2E-DEL" } });
    await page.goto(`${LIST}?q=E2E-DEL`);
    await page.getByRole("button", { name: `Actions for WEB-${tc.number}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Delete this test case?");
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(await db.testCase.count({ where: { id: tc.id } })).toBe(1);

    await page.getByRole("button", { name: `Actions for WEB-${tc.number}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expectToast(page, "Deleted 1 test case");
    await expect(page.getByText("No test cases match your filters")).toBeVisible();
    expect(await db.testCase.count({ where: { id: tc.id } })).toBe(0);
    await page.reload();
    await expect(page.getByTestId("case-row")).toHaveCount(0);
  });

  test("bulk move, bulk priority, archive and restore", async ({ page }) => {
    await page.goto(`${LIST}?q=Search`);
    const rows = page.getByTestId("case-row");
    const n = await rows.count();
    expect(n).toBeGreaterThan(1);
    await page.getByRole("checkbox", { name: "Select all on this page" }).check();
    await expect(page.getByTestId("selected-count")).toHaveText(`${n} selected`);
    await page.getByRole("button", { name: "Set field" }).click();
    await page.getByRole("menuitem", { name: "Priority" }).hover();
    await page.getByRole("menuitem", { name: "Low" }).click();
    await expectToast(page, `Updated priority on ${n} test cases`);
    const ids = (await db.testCase.findMany({ where: { title: { contains: "Search" }, archived: false } })).map((c) => c.id);
    expect((await db.testCase.findMany({ where: { id: { in: ids } } })).every((c) => c.priority === "Low")).toBe(true);

    await rows.first().getByRole("checkbox").check();
    const firstKey = (await rows.first().locator("td:nth-child(2)").innerText()).trim();
    await page.getByRole("button", { name: "Move to suite" }).click();
    await pick(page, page.getByRole("dialog").getByRole("combobox"), /^Cart\b/);
    await page.getByRole("dialog").getByRole("button", { name: "Move" }).click();
    await expectToast(page, /Moved 1 test case/);
    const moved = await db.testCase.findFirstOrThrow({ where: { number: Number(firstKey.split("-")[1]), project: { code: "WEB" } }, include: { suite: true } });
    expect(moved.suite.name).toBe("Cart");

    await rows.first().getByRole("checkbox").check();
    await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Archive" }).click();
    await expectToast(page, "Archived 1 test case");
    await expect(rows).toHaveCount(n - 1);
    expect((await db.testCase.findUniqueOrThrow({ where: { id: moved.id } })).archived).toBe(true);

    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole("checkbox").check();
    await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Restore" }).click();
    await expectToast(page, "Restored 1 test case");
    expect((await db.testCase.findUniqueOrThrow({ where: { id: moved.id } })).archived).toBe(false);
  });
});
