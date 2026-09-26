import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, expect, loginAs, test } from "./helpers";

test.describe("Password reset flow", () => {
  test.beforeEach(async () => {
    await db.passwordResetToken.deleteMany();
  });

  // ── Forgot-password form basics ────────────────────────────────────────────

  test("shows the forgot-password form and validates email format", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Forgot your password?");

    // Submit empty — inline error expected
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();

    // Type a non-email
    await page.getByRole("textbox", { name: "Email" }).fill("notanemail");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();

    // Fix to a proper email — error should clear
    await page.getByRole("textbox", { name: "Email" }).fill("someone@example.com");
    await expect(page.getByText(/valid email/i)).toHaveCount(0);
  });

  // ── Unknown-email warning ──────────────────────────────────────────────────

  test("shows account-not-found warning for an unregistered email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill("unknown@notregistered.example");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByText("No account was found with this email address. Please check the email or sign up for a new account."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();

    // "Try a different email" returns to the form
    await page.getByRole("button", { name: "Try a different email" }).click();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  });

  // ── Known-email success ────────────────────────────────────────────────────

  test("sends a reset link for a registered email and shows confirmation", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill("priya.sharma@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();

    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = await db.passwordResetToken.findFirst({ where: { userId: user.id } });
    expect(token).not.toBeNull();
  });

  // ── Reset-password page — invalid token ───────────────────────────────────

  test("shows error page for an invalid reset token", async ({ page }) => {
    await page.goto("/reset-password?token=totallyinvalidtoken");
    await expect(page.getByText("Link not valid")).toBeVisible();
  });

  // ── Expired token ─────────────────────────────────────────────────────────

  test("shows expired message for a token past its expiry", async ({ page }) => {
    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        usedAt: null,
      },
    });

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await expect(page.getByText(/expired/i)).toBeVisible();
  });

  // ── Already-used token ────────────────────────────────────────────────────

  test("shows already-used message for a consumed token", async ({ page }) => {
    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await expect(page.getByText(/already been used/i)).toBeVisible();
  });

  // ── Mismatched passwords ──────────────────────────────────────────────────

  test("rejects mismatched passwords", async ({ page }) => {
    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await page.goto(`/reset-password?token=${token}`);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill("Newpass1");
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill("Different1");
    await page.getByRole("button", { name: "Set new password" }).click();

    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  // ── Password-policy violation ─────────────────────────────────────────────

  test("rejects a password that doesn't meet the policy", async ({ page }) => {
    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await page.goto(`/reset-password?token=${token}`);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill("short");
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill("short");
    await page.getByRole("button", { name: "Set new password" }).click();

    await expect(page.getByText(/8 characters/i)).toBeVisible();
  });

  // ── Full round-trip ───────────────────────────────────────────────────────

  test("allows login with new password and rejects old password after reset", async ({ page }) => {
    const user = await db.user.findFirstOrThrow({ where: { email: "priya.sharma@example.com" } });
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    // 1. Navigate to the reset page and submit a new password
    await page.goto(`/reset-password?token=${token}`);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill("NewPassword2");
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill("NewPassword2");
    await page.getByRole("button", { name: "Set new password" }).click();

    // 2. Success state
    await expect(page.getByText("Password updated")).toBeVisible();
    const goToLogin = page.getByRole("link", { name: "Go to log in" });
    await expect(goToLogin).toBeVisible();
    await goToLogin.click();
    await expect(page).toHaveURL("/login");

    // 3. Verify token is marked used in the DB
    const used = await db.passwordResetToken.findUniqueOrThrow({ where: { token } });
    expect(used.usedAt).not.toBeNull();

    // 4. Login with the NEW password succeeds
    await loginAs(page, "priya.sharma@example.com", "NewPassword2");
    await expect(page).not.toHaveURL(/\/login/);

    // 5. Restore the original password so other tests aren't broken
    const restored = bcrypt.hashSync("Password1", 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: restored } });
  });
});
