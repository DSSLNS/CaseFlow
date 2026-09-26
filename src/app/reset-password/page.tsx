import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workflow, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) notFound();

  const record = await db.passwordResetToken.findUnique({ where: { token } });

  // Token doesn't exist
  if (!record) {
    return <InvalidToken message="This reset link is invalid or has already been used." />;
  }

  // Token already used
  if (record.usedAt) {
    return <InvalidToken message="This reset link has already been used. Please request a new one." />;
  }

  // Token expired
  if (record.expiresAt < new Date()) {
    return <InvalidToken message="This reset link has expired. Links are valid for 1 hour." />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Workflow className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a strong password for your account.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-xs">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </main>
  );
}

function InvalidToken({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Link not valid</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Request a new reset link
        </Link>
      </div>
    </main>
  );
}
