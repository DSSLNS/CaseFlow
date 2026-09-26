"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import { createProject } from "@/server/actions/projects";
import { projectSchema, type ProjectInput } from "@/lib/validation";

export function NewProjectForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues: { name: "", code: "", description: "" } });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (v) => {
        const res = await createProject(v);
        if (!res.ok) {
          for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof ProjectInput, { message: m[0] });
          toast.error(res.error);
          return;
        }
        toast.success(res.message);
        router.push(`/p/${res.data.code}/dashboard`);
      })}
    >
      <Field id="proj-name" label="Project name" required error={errors.name?.message}>
        <Input id="proj-name" {...register("name")} aria-invalid={!!errors.name || undefined} />
      </Field>
      <Field id="proj-code" label="Code" required error={errors.code?.message} hint="Prefix for test case IDs, e.g. WEB → WEB-1">
        <Input id="proj-code" className="uppercase" maxLength={10} {...register("code")} aria-invalid={!!errors.code || undefined} />
      </Field>
      <Field id="proj-description" label="Description" error={errors.description?.message}>
        <Textarea id="proj-description" rows={2} {...register("description")} />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Create project
        </Button>
      </div>
    </form>
  );
}
