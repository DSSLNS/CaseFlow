import { authenticate, db, expect, expectToast, label, pick, projectId, test } from "./helpers";

test.describe("Test suites", () => {
  test.beforeEach(async ({ page }) => { await authenticate(page); });

  test("create a suite and a sub-suite; they appear in the tree with counts", async ({ page }) => {
    await page.goto("/p/WEB/suites");
    await page.getByRole("button", { name: "New suite" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Wishlist E2E");
    await page.getByRole("textbox", { name: "Description" }).fill("Saved items");
    await page.getByRole("button", { name: "Create suite" }).click();
    await expectToast(page, 'Suite "Wishlist E2E" created');
    const tree = page.getByRole("tree", { name: "Suites" });
    await expect(tree.getByRole("link", { name: "Wishlist E2E" })).toBeVisible();

    await page.getByRole("button", { name: "Actions for suite Wishlist E2E" }).click();
    await page.getByRole("menuitem", { name: "Add sub-suite" }).click();
    await expect(label(page, "Parent suite")).toContainText("Wishlist E2E");
    await page.getByRole("textbox", { name: "Name" }).fill("Sharing");
    await page.getByRole("button", { name: "Create suite" }).click();
    await expectToast(page, 'Suite "Sharing" created');
    const child = tree.getByRole("treeitem").filter({ hasText: "Wishlist E2E" }).getByRole("group").getByRole("link", { name: "Sharing" });
    await expect(child).toBeVisible();

    const parent = await db.suite.findFirstOrThrow({ where: { name: "Wishlist E2E" } });
    const sub = await db.suite.findFirstOrThrow({ where: { name: "Sharing" } });
    expect(sub.parentId).toBe(parent.id);
    expect(parent.projectId).toBe(await projectId());

    // Count reflects cases including sub-suites.
    const loginNode = page.getByTestId("suite-node").filter({ has: page.getByRole("link", { name: "Authentication", exact: true }) });
    const authTotal = await db.testCase.count({ where: { archived: false, suite: { OR: [{ name: "Authentication" }, { parent: { name: "Authentication" } }] } } });
    await expect(loginNode.getByTestId("suite-count")).toHaveText(`${authTotal} test cases`);
  });

  test("rejects duplicate names under the same parent and renames/moves a suite", async ({ page }) => {
    await page.goto("/p/WEB/suites");
    await page.getByRole("button", { name: "New suite" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Search");
    await page.getByRole("button", { name: "Create suite" }).click();
    await expect(page.getByRole("dialog").getByText("A top-level suite with this name already exists.")).toBeVisible();
    await expectToast(page, /already exists/);
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Actions for suite User Profile" }).click();
    await page.getByRole("menuitem", { name: "Edit / move" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Account Profile");
    await pick(page, label(page, "Parent suite"), /^Authentication\b/);
    await page.getByRole("button", { name: "Save" }).click();
    await expectToast(page, 'Suite "Account Profile" updated');
    const moved = await db.suite.findFirstOrThrow({ where: { name: "Account Profile" }, include: { parent: true } });
    expect(moved.parent?.name).toBe("Authentication");
    expect(await db.testCase.count({ where: { suiteId: moved.id } })).toBeGreaterThan(0);
  });

  test("deleting a suite with cases requires choosing move or delete", async ({ page }) => {
    // Set up an isolated suite with one case.
    const pid = await projectId();
    const suite = await db.suite.create({ data: { projectId: pid, name: "Temp Delete E2E" } });
    const target = await db.suite.findFirstOrThrow({ where: { projectId: pid, name: "Search" } });
    const p = await db.project.update({ where: { id: pid }, data: { caseCounter: { increment: 1 } } });
    const tc = await db.testCase.create({ data: { projectId: pid, suiteId: suite.id, number: p.caseCounter, title: "Case in temp suite" } });

    await page.goto("/p/WEB/suites");
    await page.getByRole("button", { name: "Actions for suite Temp Delete E2E" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("contain 1 test case(s)");
    await dialog.getByRole("button", { name: "Delete suite" }).click();
    await expectToast(page, "Choose whether to move or delete the test cases.");
    expect(await db.suite.count({ where: { id: suite.id } })).toBe(1);

    await dialog.getByLabel("Move the test cases to another suite").check();
    await pick(page, dialog.getByRole("combobox"), "Search");
    await dialog.getByRole("button", { name: "Delete suite" }).click();
    await expectToast(page, /Deleted 1 suite\(s\); moved 1 test case/);
    await expect(page.getByRole("link", { name: "Temp Delete E2E" })).toHaveCount(0);
    expect(await db.suite.count({ where: { id: suite.id } })).toBe(0);
    expect((await db.testCase.findUniqueOrThrow({ where: { id: tc.id } })).suiteId).toBe(target.id);
  });
});
