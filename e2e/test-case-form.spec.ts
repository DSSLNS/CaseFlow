import fs from "node:fs";
import path from "node:path";
import { authenticate, db, expect, expectToast, label, pick, projectId, suiteId, test } from "./helpers";

const NEW = "/p/WEB/cases/new";


test.describe("Test case form", () => {
  test.beforeEach(async ({ page }) => { await authenticate(page); });

  test("renders every field with the correct label and input type", async ({ page }) => {
    await page.goto(NEW);
    const textboxes = ["Title", "Estimate", "Automation reference"];
    for (const name of textboxes) {
      const el = label(page, name);
      await expect(el, name).toBeVisible();
      expect(await el.evaluate((n) => n.tagName), name).toBe("INPUT");
    }
    for (const name of ["Description", "Preconditions"]) {
      expect(await label(page, name).evaluate((n) => n.tagName), name).toBe("TEXTAREA");
    }
    for (const name of ["Project", "Suite", "Priority", "Status", "Type", "Severity", "Assignee", "Automation status"]) {
      await expect(label(page, name), name).toHaveAttribute("role", "combobox");
    }
    await expect(page.locator("#steps\\.0\\.action")).toBeVisible();
    await expect(page.locator("#steps\\.0\\.expectedResult")).toBeVisible();
    await expect(label(page, "Tags")).toBeVisible();
    await expect(page.locator("#attachments")).toHaveAttribute("type", "file");
    await expect(label(page, "Test Case ID")).toHaveAttribute("readonly", "");
    await expect(label(page, "Test Case ID")).toHaveValue("New");
    // Defaults
    await expect(label(page, "Project")).toContainText("Web Storefront");
    await expect(label(page, "Priority")).toContainText("Medium");
    await expect(label(page, "Status")).toContainText("Draft");
    await expect(label(page, "Type")).toContainText("Functional");
    await expect(label(page, "Automation status")).toContainText("Not Automated");
  });

  test("validates required and invalid values without saving", async ({ page }) => {
    const before = await db.testCase.count();
    await page.goto(NEW);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Title is required")).toBeVisible();
    await expect(page.getByText("Suite is required")).toBeVisible();
    await expect(page.getByText("Step action is required")).toBeVisible();
    await expect(label(page, "Title")).toHaveAttribute("aria-invalid", "true");

    await label(page, "Title").fill("x".repeat(256));
    await label(page, "Estimate").fill("soon");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Title must be 255 characters or fewer")).toBeVisible();
    await expect(page.getByText("Use a duration like 30m, 1h or 1h 30m")).toBeVisible();

    // Removing the empty step clears the step error; other errors remain.
    await page.getByRole("button", { name: "Remove step 1" }).click();
    await expect(page.getByText("Step action is required")).toHaveCount(0);
    await expect(page).toHaveURL(NEW);
    expect(await db.testCase.count()).toBe(before);
  });

  test("saves every field, persists after reload, shows values when editing, and edits in place", async ({ page }) => {
    const pid = await projectId();
    const before = await db.testCase.count({ where: { projectId: pid } });
    const title = `Checkout with saved card & "quotes" — E2E-FULL`;
    await page.goto(NEW);

    await label(page, "Title").fill(title);
    await label(page, "Description").fill("Line one\nLine two <b>not html</b>");
    await label(page, "Preconditions").fill("User is signed in\nA card is saved");
    await pick(page, label(page, "Suite"), /^Payments\b/);
    await pick(page, label(page, "Priority"), "Critical");
    await pick(page, label(page, "Status"), "Ready");
    await pick(page, label(page, "Type"), "Integration");
    await pick(page, label(page, "Severity"), "Major");
    await pick(page, label(page, "Assignee"), "Maria Garcia");
    await label(page, "Tags").fill("checkout");
    await label(page, "Tags").press("Enter");
    await label(page, "Tags").fill("e2e,cards");
    await expect(page.getByTestId("tag-chip")).toHaveCount(3);
    await label(page, "Estimate").fill("1h 15m");
    await pick(page, label(page, "Automation status"), "To Automate");
    await label(page, "Automation reference").fill("e2e/checkout/saved-card.spec.ts");

    await page.locator("#steps\\.0\\.action").fill("Open the cart");
    await page.locator("#steps\\.0\\.expectedResult").fill("Cart shows 1 item");
    await page.getByRole("button", { name: "Add step" }).click();
    await page.locator("#steps\\.1\\.action").fill("Choose the saved card");
    await page.locator("#steps\\.1\\.expectedResult").fill("Card ending 4242 is selected");
    await page.getByRole("button", { name: "Add step" }).click();
    await page.locator("#steps\\.2\\.action").fill("Proceed to checkout");
    await page.locator("#steps\\.2\\.expectedResult").fill("Payment step is shown");
    // Reorder: "Proceed to checkout" should become step 2.
    await page.getByRole("button", { name: "Move step 3 up" }).click();
    await expect(page.locator("#steps\\.1\\.action")).toHaveValue("Proceed to checkout");

    await page.locator("#attachments").setInputFiles({ name: "evidence-ü.txt", mimeType: "text/plain", buffer: Buffer.from("hello attachment") });
    await expect(page.getByText("evidence-ü.txt")).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/p\/WEB\/cases\/WEB-\d+$/);
    await expectToast(page, /WEB-\d+ created/);
    const key = page.url().split("/").pop()!;
    const number = Number(key.split("-")[1]);

    // Database check: every field stored exactly.
    const saved = await db.testCase.findUniqueOrThrow({
      where: { projectId_number: { projectId: pid, number } },
      include: { steps: { orderBy: { position: "asc" } }, tags: { include: { tag: true } }, suite: true, assignee: true, attachments: true },
    });
    expect(saved.title).toBe(title);
    expect(saved.description).toBe("Line one\nLine two <b>not html</b>");
    expect(saved.preconditions).toBe("User is signed in\nA card is saved");
    expect(saved.suite.name).toBe("Payments");
    expect(saved.projectId).toBe(pid);
    expect(saved.priority).toBe("Critical");
    expect(saved.status).toBe("Ready");
    expect(saved.type).toBe("Integration");
    expect(saved.severity).toBe("Major");
    expect(saved.assignee?.name).toBe("Maria Garcia");
    expect(saved.tags.map((t) => t.tag.name).sort()).toEqual(["cards", "checkout", "e2e"]);
    expect(saved.estimateMinutes).toBe(75);
    expect(saved.automationStatus).toBe("To Automate");
    expect(saved.automationRef).toBe("e2e/checkout/saved-card.spec.ts");
    expect(saved.steps.map((s) => [s.action, s.expectedResult])).toEqual([
      ["Open the cart", "Cart shows 1 item"],
      ["Proceed to checkout", "Payment step is shown"],
      ["Choose the saved card", "Card ending 4242 is selected"],
    ]);
    expect(saved.createdById).toBeTruthy();
    expect(saved.updatedById).toBe(saved.createdById);
    expect(saved.attachments.map((a) => a.filename)).toEqual(["evidence-ü.txt"]);
    expect(fs.readFileSync(path.join("storage", "attachments", saved.attachments[0].id), "utf8")).toBe("hello attachment");
    expect(await db.testCase.count({ where: { projectId: pid } })).toBe(before + 1);

    // Persisted after reload: view page.
    await page.reload();
    await expect(page.getByTestId("case-title")).toHaveText(title);
    await expect(page.getByTestId("case-description")).toHaveText("Line one\nLine two <b>not html</b>");
    await expect(page.getByTestId("case-preconditions")).toHaveText("User is signed in\nA card is saved");
    await expect(page.getByTestId("case-project")).toHaveText("Web Storefront");
    await expect(page.getByTestId("case-suite")).toHaveText("Checkout > Payments");
    await expect(page.getByTestId("case-priority")).toHaveText("Critical");
    await expect(page.getByTestId("case-status")).toHaveText("Ready");
    await expect(page.getByTestId("case-type")).toHaveText("Integration");
    await expect(page.getByTestId("case-severity")).toHaveText("Major");
    await expect(page.getByTestId("case-assignee")).toHaveText("Maria Garcia");
    for (const t of ["checkout", "e2e", "cards"]) await expect(page.getByTestId("case-tags")).toContainText(t);
    await expect(page.getByTestId("case-estimate")).toHaveText("1h 15m");
    await expect(page.getByTestId("case-automation")).toHaveText("To Automate");
    await expect(page.getByTestId("case-automation-ref")).toHaveText("e2e/checkout/saved-card.spec.ts");
    await expect(page.getByTestId("view-step")).toHaveCount(3);
    await expect(page.getByTestId("view-step").nth(1)).toContainText("Proceed to checkout");
    await expect(page.getByTestId("case-attachments")).toContainText("evidence-ü.txt");
    const download = await page.request.get(`/api/attachments/${saved.attachments[0].id}`);
    expect(await download.text()).toBe("hello attachment");

    // Values appear when editing.
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(`/p/WEB/cases/${key}/edit`);
    await expect(label(page, "Test Case ID")).toHaveValue(key);
    await expect(label(page, "Title")).toHaveValue(title);
    await expect(label(page, "Description")).toHaveValue("Line one\nLine two <b>not html</b>");
    await expect(label(page, "Preconditions")).toHaveValue("User is signed in\nA card is saved");
    await expect(label(page, "Project")).toContainText("Web Storefront");
    await expect(label(page, "Suite")).toContainText("Payments");
    await expect(label(page, "Priority")).toContainText("Critical");
    await expect(label(page, "Status")).toContainText("Ready");
    await expect(label(page, "Type")).toContainText("Integration");
    await expect(label(page, "Severity")).toContainText("Major");
    await expect(label(page, "Assignee")).toContainText("Maria Garcia");
    await expect(page.getByTestId("tag-chip")).toHaveText(["checkout", "e2e", "cards"]);
    await expect(label(page, "Estimate")).toHaveValue("1h 15m");
    await expect(label(page, "Automation status")).toContainText("To Automate");
    await expect(label(page, "Automation reference")).toHaveValue("e2e/checkout/saved-card.spec.ts");
    await expect(page.locator("#steps\\.2\\.action")).toHaveValue("Choose the saved card");
    await expect(page.getByTestId("meta-created")).not.toHaveText(/^—/);

    // Edit every kind of field; the same record must be updated.
    const newTitle = `${title} (edited)`;
    await label(page, "Title").fill(newTitle);
    await label(page, "Description").fill("Edited description");
    await label(page, "Preconditions").fill("");
    await pick(page, label(page, "Suite"), /^Cart\b/);
    await pick(page, label(page, "Priority"), "Low");
    await pick(page, label(page, "Status"), "Deprecated");
    await pick(page, label(page, "Type"), "UI");
    await pick(page, label(page, "Severity"), "Not set");
    await pick(page, label(page, "Assignee"), "Unassigned");
    await page.getByRole("button", { name: "Remove tag e2e" }).click();
    await label(page, "Estimate").fill("20");
    await pick(page, label(page, "Automation status"), "Automated");
    await label(page, "Automation reference").fill("https://ci.example.com/job/42");
    await page.locator("#steps\\.0\\.action").fill("Open the cart (edited)");
    await page.getByRole("button", { name: "Remove step 2" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(`/p/WEB/cases/${key}`);
    await expectToast(page, `${key} updated`);

    const edited = await db.testCase.findUniqueOrThrow({
      where: { id: saved.id },
      include: { steps: { orderBy: { position: "asc" } }, tags: { include: { tag: true } }, suite: true },
    });
    expect(edited.title).toBe(newTitle);
    expect(edited.description).toBe("Edited description");
    expect(edited.preconditions).toBe("");
    expect(edited.suite.name).toBe("Cart");
    expect(edited.priority).toBe("Low");
    expect(edited.status).toBe("Deprecated");
    expect(edited.type).toBe("UI");
    expect(edited.severity).toBeNull();
    expect(edited.assigneeId).toBeNull();
    expect(edited.tags.map((t) => t.tag.name).sort()).toEqual(["cards", "checkout"]);
    expect(edited.estimateMinutes).toBe(20);
    expect(edited.automationStatus).toBe("Automated");
    expect(edited.automationRef).toBe("https://ci.example.com/job/42");
    expect(edited.steps.map((s) => s.action)).toEqual(["Open the cart (edited)", "Choose the saved card"]);
    expect(edited.number).toBe(number);
    expect(await db.testCase.count({ where: { projectId: pid } })).toBe(before + 1);
    expect(await db.testCase.count({ where: { title: { startsWith: "Checkout with saved card" } } })).toBe(1);

    await page.reload();
    await expect(page.getByTestId("case-title")).toHaveText(newTitle);
    await expect(page.getByTestId("case-suite")).toHaveText("Checkout > Cart");
    await expect(page.getByTestId("case-severity")).toHaveText("—");
    await expect(page.getByTestId("case-assignee")).toHaveText("Unassigned");
    await expect(page.getByTestId("case-estimate")).toHaveText("20m");
  });

  test("Save and add another keeps the suite and resets the form", async ({ page }) => {
    const sid = await suiteId("Search");
    await page.goto(`${NEW}?suite=${sid}`);
    await expect(label(page, "Suite")).toContainText("Search");
    await label(page, "Title").fill("First of a batch E2E-ANOTHER");
    await page.locator("#steps\\.0\\.action").fill("Do the first thing");
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expectToast(page, /created/);
    await expect(page).toHaveURL(new RegExp(`${NEW}`));
    await expect(label(page, "Title")).toHaveValue("");
    await expect(label(page, "Suite")).toContainText("Search");
    const saved = await db.testCase.findFirstOrThrow({ where: { title: "First of a batch E2E-ANOTHER" } });
    expect(saved.suiteId).toBe(sid);
  });

  test("Save as draft stores Draft status regardless of the selected status", async ({ page }) => {
    await page.goto(`${NEW}?suite=${await suiteId("Search")}`);
    await label(page, "Title").fill("Draft save E2E-DRAFT");
    await page.getByRole("button", { name: "Remove step 1" }).click();
    await pick(page, label(page, "Status"), "Ready");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page).toHaveURL(/\/cases\/WEB-\d+$/);
    await expect(page.getByTestId("case-status")).toHaveText("Draft");
    expect((await db.testCase.findFirstOrThrow({ where: { title: "Draft save E2E-DRAFT" } })).status).toBe("Draft");
  });

  test("Cancel leaves without saving", async ({ page }) => {
    const before = await db.testCase.count();
    await page.goto(NEW);
    await label(page, "Title").fill("Should not be saved E2E-CANCEL");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL("/p/WEB/cases");
    expect(await db.testCase.count()).toBe(before);
  });

  test("changing project reloads suites and assigns an ID in the new project", async ({ page }) => {
    await page.goto(NEW);
    await label(page, "Title").fill("Cross-project case E2E-MOB");
    await page.getByRole("button", { name: "Remove step 1" }).click();
    await pick(page, label(page, "Project"), /Mobile App/);
    await expect(label(page, "Suite")).toContainText("Select a suite");
    await label(page, "Suite").click();
    await expect(page.getByRole("option", { name: /Payments/ })).toHaveCount(0);
    await page.getByRole("option", { name: /Onboarding/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/p\/MOB\/cases\/MOB-\d+$/);
    const c = await db.testCase.findFirstOrThrow({ where: { title: "Cross-project case E2E-MOB" }, include: { project: true } });
    expect(c.project.code).toBe("MOB");
  });
});
