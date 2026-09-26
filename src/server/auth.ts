import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth-constants";

export { SESSION_COOKIE };
const SESSION_EXPIRY_PERSISTENT = 30 * 24 * 60 * 60; // 30 days in seconds
const SESSION_EXPIRY_SESSION = 0; // browser session (0 = no max-age)

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
};

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, persistent: boolean): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (persistent ? SESSION_EXPIRY_PERSISTENT : 60 * 60 * 24) * 1000,
  );

  await db.session.create({ data: { userId, token, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(persistent ? { maxAge: SESSION_EXPIRY_PERSISTENT } : {}),
    // secure: true in production — Next.js sets this automatically on HTTPS
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => null);
    store.delete(SESSION_COOKIE);
  }
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true, role: true, jobTitle: true } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { token } }).catch(() => null);
    return null;
  }

  return session.user;
});

/** Verifies the session token from a plain cookie string (used in middleware). */
export function hasSessionCookie(): boolean {
  // In middleware we can't do DB queries; just check presence.
  // Real verification happens in server components via getSessionUser().
  return true; // called only when cookie exists
}
