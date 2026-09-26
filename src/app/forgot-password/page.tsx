import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Workflow className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-xs">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
