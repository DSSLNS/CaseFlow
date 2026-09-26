"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/common/field";
import { loginSchema, type LoginInput } from "@/lib/auth-schema";
import { login } from "@/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", persistent: false },
  });

  const persistent = watch("persistent");

  function onSubmit(data: LoginInput) {
    startTransition(async () => {
      const res = await login(data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const next = searchParams.get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.push(destination);
    });
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
          aria-invalid={!!errors.email || undefined}
          {...register("email")}
        />
      </Field>

      <Field id="password" label="Password" required error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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

      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
          <Checkbox
            id="persistent"
            checked={persistent}
            onCheckedChange={(v) => setValue("persistent", !!v)}
            disabled={pending}
          />
          Keep me logged in
        </label>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline focus-visible:underline focus-visible:outline-none">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Log in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
          Sign up
        </Link>
      </p>
    </form>
  );
}
