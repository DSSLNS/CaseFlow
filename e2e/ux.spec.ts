import { authenticate, db, expect, expectToast, projectId, test } from "./helpers";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("Responsive layout", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}px): no horizontal page scroll and navigation is reachable`, async ({ page }) => {
      await authenticate(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const run = await db.testRun.findFirstOrThrow({ where: { title: "Release 2.3 Regression" } });
      const e2eRun = await db.testRun.findFirst({ where: { title: "Deploy 2.5.0 regression E2E" } });
      const paths = [
        "/p/WEB/dashboard",
        "/p/WEB/cases",
        "/p/WEB/cases/new",
        "/p/WEB/cases/WEB-1",
        "/p/WEB/suites",
        "/p/WEB/runs",
        `/p/WEB/runs/${run.id}`,
        `/p/WEB/runs/${run.id}/report`,
        ...(e2eRun ? [`/p/WEB/runs/${e2eRun.id}`, `/p/WEB/runs/${e2eRun.id}/report`] : []),
        "/p/WEB/import",
        "/p/WEB/reports",
        "/p/WEB/settings",
      ];
      for (const p of paths) {
        await page.goto(p);
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `horizontal overflow on ${p}`).toBeLessThanOrEqual(0);
      }
      await page.goto("/p/WEB/dashboard");
      if (vp.width >= 1024) {
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
      } else {
        await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("dialog").getByRole("link", { name: "Test Runs" }).click();
        await expect(page).toHaveURL("/p/WEB/runs");
        await expect(page.getByRole("dialog")).toBeHidden();
      }
    });
  }
});

test.describe("Keyboard and focus", () => {
  test("skip link, sidebar navigation and form fields are keyboard operable with visible focus", async ({ page }) => {
    await authenticate(page);
    await page.goto("/p/WEB/dashboard");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.width).toBeGreaterThan(20);

    // Tab to the "Test Cases" nav link and activate it with Enter.
    let found = false;
    for (let i = 0; i < 15 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Test Cases");
    }
    expect(found).toBe(true);
    const focusStyle = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
    });
    expect(focusStyle.outline !== "none" || focusStyle.shadow !== "none").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/p/WEB/cases");

    await page.goto("/p/WEB/cases/new");
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeFocused();
    await page.keyboard.type("Keyboard only case");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: "Description" })).toBeFocused();
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement as Element).boxShadow);
    expect(ring).not.toBe("none");

    // Radix selects open with the keyboard.
    const priority = page.getByRole("combobox", { name: "Priority" });
    await priority.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });
});

test.describe("Actions are real and failures are reported honestly", () => {
  test("every sidebar item and dashboard quick action opens a working page", async ({ page }) => {
    await authenticate(page);
    await page.goto("/p/WEB/dashboard");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const [name, url, heading] of [
      ["Dashboard", "/p/WEB/dashboard", "Dashboard"],
      ["Test Cases", "/p/WEB/cases", "Test Cases"],
      ["Test Suites", "/p/WEB/suites", "Test Suites"],
      ["Test Runs", "/p/WEB/runs", "Test Runs"],
      ["Import Test Cases", "/p/WEB/import", "Import Test Cases"],
      ["Reports", "/p/WEB/reports", "Reports"],
      ["Settings", "/p/WEB/settings", "Settings"],
    ]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    for (const [name, url] of [
      ["Create test case", "/p/WEB/cases/new"],
      ["Create suite", "/p/WEB/suites"],
      ["Import test cases", "/p/WEB/import"],
      ["Start test run", "/p/WEB/runs/new"],
    ]) {
      await page.getByRole("main").getByRole("link", { name, exact: true }).last().click();
      await expect(page).toHaveURL(new RegExp(`${url}`));
      if (name === "Create suite") await expect(page.getByRole("dialog", { name: "New suite" })).toBeVisible();
      await page.goto("/p/WEB/dashboard");
    }
    // Project switcher and user menu work.
    await page.getByRole("button", { name: /Switch project/ }).click();
    await page.getByRole("menuitem", { name: /Mobile App/ }).click();
    await expect(page).toHaveURL("/p/MOB/dashboard");
    await page.getByRole("button", { name: "User menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("all visible buttons on key pages have an accessible name", async ({ page }) => {
    await authenticate(page);
    for (const p of ["/p/WEB/dashboard", "/p/WEB/cases", "/p/WEB/cases/new", "/p/WEB/suites", "/p/WEB/import", "/p/WEB/runs/new"]) {
      await page.goto(p);
      const unnamed = await page.$$eval("button:not([aria-hidden='true'])", (els) =>
        els
          .filter((b) => (b as HTMLElement).offsetParent !== null)
          .filter(
            (b) =>
              !(
                b.getAttribute("aria-label") ||
                b.getAttribute("aria-labelledby") ||
                b.textContent?.trim() ||
                b.getAttribute("title") ||
                (b as HTMLButtonElement).labels?.length
              ),
          )
          .map((b) => b.outerHTML.slice(0, 120)),
      );
      expect(unnamed, p).toEqual([]);
    }
  });

  test("deleting a case that no longer exists shows an error, not success", async ({ page }) => {
    await authenticate(page);
    const pid = await projectId();
    const suite = await db.suite.findFirstOrThrow({ where: { projectId: pid, name: "Search" } });
    const p = await db.project.update({ where: { id: pid }, data: { caseCounter: { increment: 1 } } });
    const tc = await db.testCase.create({ data: { projectId: pid, suiteId: suite.id, number: p.caseCounter, title: "Vanishing case E2E-GONE" } });
    await page.goto("/p/WEB/cases?q=E2E-GONE");
    await db.testCase.delete({ where: { id: tc.id } }); // deleted elsewhere
    await page.getByRole("button", { name: `Actions for WEB-${tc.number}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expectToast(page, "No matching test cases were found; nothing was deleted.");
    await expect(page.locator("[data-sonner-toast][data-type='success']")).toHaveCount(0);
  });

  test("recording a result on a run completed elsewhere is rejected with a clear error", async ({ page }) => {
    await authenticate(page);
    const run = await db.testRun.findFirstOrThrow({ where: { title: "Sprint 18 Smoke" }, include: { cases: true } });
    await page.goto(`/p/WEB/runs/${run.id}`);
    await db.testRun.update({ where: { id: run.id }, data: { status: "Completed" } });
    const before = await db.testExecution.count({ where: { runCase: { runId: run.id } } });
    await page.getByRole("radio", { name: "Blocked" }).click();
    await page.getByRole("button", { name: "Save result" }).click();
    await expectToast(page, "This run is completed. Reopen it to record results.");
    await expect(page.locator("[data-sonner-toast][data-type='success']")).toHaveCount(0);
    expect(await db.testExecution.count({ where: { runCase: { runId: run.id } } })).toBe(before);
    await db.testRun.update({ where: { id: run.id }, data: { status: "Active" } });
  });

  test("integrations that are not configured are labelled, with no fake controls", async ({ page }) => {
    await authenticate(page);
    await page.goto("/p/WEB/settings");
    const list = page.getByTestId("integrations");
    await expect(list.getByText("Not configured")).toHaveCount(3);
    await expect(list.getByRole("button")).toHaveCount(0);
  });
});
