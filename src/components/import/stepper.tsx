import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Upload", "Preview", "Map columns", "Validate", "Confirm", "Results"] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label="Import progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn(active ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
