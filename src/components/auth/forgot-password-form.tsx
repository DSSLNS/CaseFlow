"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth-schema";
import { requestPasswordReset } from "@/server/actions/auth";

type FormState = "idle" | "not_found" | "sent";

export function ForgotPasswordForm() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(data: ForgotPasswordInput) {
    startTransition(async () => {
      const res = await requestPasswordReset(data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFormState(res.data.found ? "sent" : "not_found");
    });
  }

  function handleTryAgain() {
    reset();
    setFormState("idle");
    // Re-focus after state update flushes
    setTimeout(() => setFocus("email"), 0);
  }

  if (formState === "sent") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </div>
        <div>
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If that address is registered, we&apos;ve sent a reset link. It expires in 1&nbsp;hour.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  if (formState === "not_found") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <UserX className="size-6" />
        </div>
        <div>
          <p className="font-medium">No account found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No account was found with this email address. Please check the email or sign up for a new account.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" onClick={handleTryAgain}>
            Try a different email
          </Button>
          <Link
            href="/signup"
            className="text-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <Field id="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          disabled={pending}
          placeholder="you@example.com"
          aria-invalid={!!errors.email || undefined}
          {...register("email")}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
