"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { signupSchema, type SignupInput } from "@/lib/auth-schema";
import { signup } from "@/server/actions/auth";

const JOB_TITLES = [
  "QA Engineer",
  "QA Lead",
  "Software Developer",
  "Product Manager",
  "Designer",
  "DevOps Engineer",
  "Other",
];

export function SignupForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", jobTitle: "" },
  });

  function onSubmit(data: SignupInput) {
    startTransition(async () => {
      const res = await signup(data);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            if (msgs?.[0]) setError(k as keyof SignupInput, { message: msgs[0] });
          }
        }
        toast.error(res.error);
        return;
      }
      toast.success("Account created! Welcome to CaseFlow.");
      router.push(res.data.redirect);
    });
  }

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <Field id="name" label="Full name" required error={errors.name?.message}>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          autoFocus
          disabled={pending}
          aria-invalid={!!errors.name || undefined}
          {...register("name")}
        />
      </Field>

      <Field id="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          disabled={pending}
          aria-invalid={!!errors.email || undefined}
          {...register("email")}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        required
        error={errors.password?.message}
        hint="Min. 8 characters with uppercase, lowercase, and a number"
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

      <Field id="confirmPassword" label="Confirm password" required error={errors.confirmPassword?.message}>
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

      <Field id="jobTitle" label="Role" error={errors.jobTitle?.message} hint="Your job function — for display only">
        <select
          id="jobTitle"
          disabled={pending}
          aria-invalid={!!errors.jobTitle || undefined}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          {...register("jobTitle")}
        >
          <option value="">Select a role (optional)</option>
          {JOB_TITLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        New accounts are granted <strong>Member</strong> access. Contact an administrator if you need elevated permissions.
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
          Log in
        </Link>
      </p>
    </form>
  );
}
