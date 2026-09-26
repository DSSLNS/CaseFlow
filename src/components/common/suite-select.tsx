"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SuiteOption } from "@/lib/suite-tree";
import { cn } from "@/lib/utils";

export const NONE = "__none__";

export function SuiteSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select a suite",
  allowNone,
  noneLabel = "None",
  disabledIds = [],
  invalid,
  className,
  size,
}: {
  id?: string;
  options: SuiteOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabledIds?: string[];
  invalid?: boolean;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value || (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn("w-full", className)} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} disabled={disabledIds.includes(o.id)} textValue={o.path}>
            <span style={{ paddingLeft: o.depth * 14 }} className={cn(o.depth > 0 && "text-muted-foreground")}>
              {o.depth > 0 && <span aria-hidden>↳ </span>}
              <span className="text-foreground">{o.name}</span>
              {o.depth > 0 && <span className="sr-only">, in {o.path.slice(0, o.path.lastIndexOf(" > "))}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
