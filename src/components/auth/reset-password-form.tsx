"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth-schema";
import { resetPassword } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  function onSubmit(data: ResetPasswordInput) {
    startTransition(async () => {
      const res = await resetPassword(data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <p className="font-medium">Password updated</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password has been changed. You can now log in with your new password.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      {/* Hidden token field — value set via defaultValues */}
      <input type="hidden" {...register("token")} />

      <Field
        id="password"
        label="New password"
        required
        error={errors.password?.message}
        hint="Min. 8 characters with uppercase, lowercase, and a number"
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            disabled={pending}
            aria-invalid={!!errors.password || undefined}
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Field id="confirmPassword" label="Confirm new password" required error={errors.confirmPassword?.message}>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            disabled={pending}
            aria-invalid={!!errors.confirmPassword || undefined}
            className="pr-10"
            {...register("confirmPassword")}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={showConfirm ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Set new password
      </Button>
    </form>
  );
}
