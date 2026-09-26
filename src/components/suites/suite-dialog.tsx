"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SuiteSelect } from "@/components/common/suite-select";
import { saveSuite } from "@/server/actions/suites";
import { descendantIds } from "@/lib/suite-tree";
import type { SuiteOption } from "@/lib/suite-tree";
import { suiteSchema, type SuiteInput } from "@/lib/validation";

export type EditingSuite = { id: string | null; name: string; description: string; parentId: string };

export function SuiteDialog({
  projectId,
  suites,
  editing,
  onClose,
  onSaved,
}: {
  projectId: string;
  suites: SuiteOption[];
  editing: EditingSuite | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<SuiteInput>({
    resolver: zodResolver(suiteSchema),
    defaultValues: { projectId, name: "", description: "", parentId: "" },
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (editing) reset({ projectId, name: editing.name, description: editing.description, parentId: editing.parentId });
  }, [editing, projectId, reset]);

  const blocked = editing?.id ? descendantIds(suites, editing.id) : [];

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent>
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const res = await saveSuite(editing?.id ?? null, values);
            if (!res.ok) {
              for (const [f, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(f as keyof SuiteInput, { message: m[0] });
              toast.error(res.error);
              return;
            }
            toast.success(res.message);
            onSaved();
          })}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit suite" : "New suite"}</DialogTitle>
            <DialogDescription>Suites group related test cases. Nest them to mirror your product areas.</DialogDescription>
          </DialogHeader>
          <Field id="suite-name" label="Name" required error={errors.name?.message}>
            <Input id="suite-name" autoFocus aria-invalid={!!errors.name || undefined} {...register("name")} />
          </Field>
          <Field id="suite-parent" label="Parent suite" error={errors.parentId?.message}>
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <SuiteSelect
                  id="suite-parent"
                  options={suites}
                  value={field.value}
                  onChange={field.onChange}
                  allowNone
                  noneLabel="None (top level)"
                  disabledIds={blocked}
                />
              )}
            />
          </Field>
          <Field id="suite-description" label="Description" error={errors.description?.message}>
            <Textarea id="suite-description" rows={3} {...register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              {editing?.id ? "Save" : "Create suite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
