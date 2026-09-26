import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Workflow className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your CaseFlow account
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-xs">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
