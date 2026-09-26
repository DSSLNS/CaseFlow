import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Minus,
  CheckCircle2,
  XCircle,
  Ban,
  Circle,
} from "lucide-react";

const base = "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

const PRIORITY_STYLE: Record<string, { cls: string; Icon: typeof ArrowUp }> = {
  Low: { cls: "border-slate-200 bg-slate-50 text-slate-600", Icon: ArrowDown },
  Medium: { cls: "border-sky-200 bg-sky-50 text-sky-700", Icon: Minus },
  High: { cls: "border-orange-200 bg-orange-50 text-orange-700", Icon: ArrowUp },
  Critical: { cls: "border-red-200 bg-red-50 text-red-700", Icon: ChevronsUp },
};

export function PriorityBadge({ value }: { value: string }) {
  const s = PRIORITY_STYLE[value] ?? PRIORITY_STYLE.Medium;
  return (
    <span className={cn(base, s.cls)}>
      <s.Icon className="size-3" aria-hidden />
      {value}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Draft: "border-amber-200 bg-amber-50 text-amber-800",
  Ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Deprecated: "border-slate-200 bg-slate-100 text-slate-500 line-through decoration-slate-400",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={cn(base, STATUS_STYLE[value] ?? STATUS_STYLE.Draft)}>{value}</span>;
}

export function TypeBadge({ value }: { value: string }) {
  return <span className={cn(base, "border-border bg-muted/60 text-muted-foreground")}>{value}</span>;
}

export const RESULT_STYLE: Record<string, { cls: string; dot: string; Icon: typeof Circle }> = {
  Pass: { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", Icon: CheckCircle2 },
  Fail: { cls: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", Icon: XCircle },
  Blocked: { cls: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500", Icon: Ban },
  "Not Run": { cls: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-300", Icon: Circle },
};

export function ResultBadge({ value }: { value: string }) {
  const s = RESULT_STYLE[value] ?? RESULT_STYLE["Not Run"];
  return (
    <span className={cn(base, s.cls)}>
      <s.Icon className="size-3" aria-hidden />
      {value}
    </span>
  );
}

export function RunStatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        base,
        value === "Completed" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-blue-200 bg-blue-50 text-blue-700",
      )}
    >
      {value === "Active" ? "In progress" : value}
    </span>
  );
}
