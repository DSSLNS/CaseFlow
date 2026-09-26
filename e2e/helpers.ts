import { randomBytes } from "node:crypto";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/** Direct database access for verifying what the UI actually stored. */
export const db = new PrismaClient({ datasources: { db: { url: "file:./e2e.db" } } });

/**
 * Every test fails on uncaught page errors or console errors, so broken
 * interactions cannot pass silently.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) {
          errors.push(`console: ${m.text()}`);
        }
      });
      await use(errors);
      expect(errors, "no console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function projectId(code = "WEB") {
  return (await db.project.findUniqueOrThrow({ where: { code } })).id;
}

export async function suiteId(name: string, code = "WEB") {
  return (await db.suite.findFirstOrThrow({ where: { name, project: { code } } })).id;
}

/** Picks an option in a Radix Select identified by its trigger. */
export async function pick(page: Page, trigger: Locator, option: string | RegExp) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

/** Role + accessible name, so tests also prove each control is labelled correctly. */
export const label = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true }).or(page.getByRole("combobox", { name, exact: true }));

/**
 * Bypasses the login UI by inserting a session row directly into the e2e DB
 * and setting the tcm_session cookie. Use this in tests that aren't testing auth.
 */
export async function authenticate(page: Page): Promise<void> {
  const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId: user.id, token, expiresAt } });
  await page.context().addCookies([
    {
      name: "tcm_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Logs in via the real UI form. Use this in tests that exercise the login flow itself.
 */
export async function loginAs(page: Page, email: string, password = "Password1"): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}
