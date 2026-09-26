"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginInput,
  type SignupInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/auth-schema";
import { createSession, destroySession } from "@/server/auth";
import { parseOrFail, toFailure } from "./helpers";

export type { LoginInput, SignupInput, ForgotPasswordInput, ResetPasswordInput };

const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE_LIMIT = 3; // max requests per email per hour
const RESET_MAX_ATTEMPTS = 5; // max wrong submissions before a token is voided

export async function login(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  const parsed = parseOrFail(loginSchema, input);
  if (!parsed.ok) return parsed.result;
  const { email, password, persistent } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return fail("Incorrect email or password.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail("Incorrect email or password.");

    await createSession(user.id, persistent);
    return ok({ redirect: "/" });
  } catch (e) {
    return toFailure(e);
  }
}

export async function signup(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  const parsed = parseOrFail(signupSchema, input);
  if (!parsed.ok) return parsed.result;
  const { name, email, password, jobTitle } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return fail("An account with that email already exists.", {
        email: ["An account with that email already exists."],
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, passwordHash, jobTitle: jobTitle || "", role: "member" },
    });

    await createSession(user.id, false);
    return ok({ redirect: "/projects" });
  } catch (e) {
    return toFailure(e);
  }
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult<{ found: boolean }>> {
  const parsed = parseOrFail(forgotPasswordSchema, input);
  if (!parsed.ok) return parsed.result;
  const { email } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return ok({ found: false });
    }

    // Rate limit: count tokens issued for this user in the last hour.
    const windowStart = new Date(Date.now() - RESET_EXPIRY_MS);
    const recentCount = await db.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: windowStart } },
    });
    if (recentCount >= RESET_RATE_LIMIT) {
      // Don't reveal that the limit was hit — treat as not-found from caller's perspective.
      return ok({ found: false });
    }

    // Invalidate any existing unused tokens for this user.
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);
    await db.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    // In production, send an email here. For now, log the link so it is accessible during development.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    console.log(`\n[Password Reset] Link for ${email}:\n  ${resetUrl}\n`);

    return ok({ found: true });
  } catch (e) {
    return toFailure(e);
  }
}

export async function resetPassword(input: unknown): Promise<ActionResult<null>> {
  const parsed = parseOrFail(resetPasswordSchema, input);
  if (!parsed.ok) return parsed.result;
  const { token, password } = parsed.data;

  try {
    const record = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) return fail("This reset link is invalid or has already been used.");
    if (record.usedAt) return fail("This reset link has already been used. Request a new one.");
    if (record.expiresAt < new Date()) return fail("This reset link has expired. Request a new one.");
    if (record.attempts >= RESET_MAX_ATTEMPTS) {
      return fail("Too many failed attempts. Please request a new reset link.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // Mark token used and record final attempt count
      db.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date(), attempts: { increment: 1 } },
      }),
      // Invalidate all active sessions so the old password can't be reused.
      db.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return ok(null, "Password updated. You can now log in with your new password.");
  } catch (e) {
    return toFailure(e);
  }
}
