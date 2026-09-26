"use client";

import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TestCaseInput } from "@/lib/validation";

export function StepsEditor({
  control,
  register,
  errors,
}: {
  control: Control<TestCaseInput>;
  register: UseFormRegister<TestCaseInput>;
  errors: FieldErrors<TestCaseInput>;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          <ListOrdered className="size-4" aria-hidden /> No steps yet. Add the actions a tester should perform and what they should
          see.
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const err = errors.steps?.[index];
          return (
            <li key={field.id} className="rounded-lg border bg-muted/30 p-2.5" data-testid="step-row">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Step {index + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move step ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move step ${index + 1} down`}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`steps.${index}.action`} className="text-xs font-medium">
                    Action<span className="text-destructive" aria-hidden>*</span>
                  </label>
                  <Textarea
                    id={`steps.${index}.action`}
                    rows={2}
                    aria-invalid={!!err?.action || undefined}
                    placeholder="What the tester does"
                    className="min-h-14 bg-background"
                    {...register(`steps.${index}.action`)}
                  />
                  {err?.action && (
                    <p role="alert" className="text-xs text-destructive">
                      {err.action.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`steps.${index}.expectedResult`} className="text-xs font-medium">
                    Expected result
                  </label>
                  <Textarea
                    id={`steps.${index}.expectedResult`}
                    rows={2}
                    aria-invalid={!!err?.expectedResult || undefined}
                    placeholder="What should happen"
                    className="min-h-14 bg-background"
                    {...register(`steps.${index}.expectedResult`)}
                  />
                  {err?.expectedResult && (
                    <p role="alert" className="text-xs text-destructive">
                      {err.expectedResult.message}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ action: "", expectedResult: "" })}>
          <Plus aria-hidden /> Add step
        </Button>
      </div>
      {errors.steps?.message && <p className="text-xs text-destructive">{errors.steps.message}</p>}
    </div>
  );
}
