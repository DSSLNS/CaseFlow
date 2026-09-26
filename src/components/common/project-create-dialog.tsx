"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import { createProject } from "@/server/actions/projects";
import { projectSchema, type ProjectInput } from "@/lib/validation";

export function ProjectCreateDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  async function onSubmit(v: ProjectInput) {
    const res = await createProject(v);
    if (!res.ok) {
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) {
        if (m?.[0]) setError(k as keyof ProjectInput, { message: m[0] });
      }
      toast.error(res.error);
      return;
    }
    toast.success(res.message);
    setOpen(false);
    reset();
    router.push(`/p/${res.data.code}/dashboard`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Set up a new test project. You&apos;ll be its owner and can invite others later.
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="flex flex-col gap-4 pt-2" onSubmit={handleSubmit(onSubmit)}>
          <Field id="dlg-proj-name" label="Project name" required error={errors.name?.message}>
            <Input
              id="dlg-proj-name"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!errors.name || undefined}
              {...register("name")}
            />
          </Field>
          <Field
            id="dlg-proj-code"
            label="Code"
            required
            error={errors.code?.message}
            hint="Prefix for test case IDs — e.g. WEB → WEB-1"
          >
            <Input
              id="dlg-proj-code"
              className="uppercase"
              maxLength={10}
              disabled={isSubmitting}
              aria-invalid={!!errors.code || undefined}
              {...register("code")}
            />
          </Field>
          <Field id="dlg-proj-desc" label="Description" error={errors.description?.message}>
            <Textarea
              id="dlg-proj-desc"
              rows={2}
              disabled={isSubmitting}
              {...register("description")}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              Create project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
