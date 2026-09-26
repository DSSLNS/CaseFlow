"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuiteSelect } from "@/components/common/suite-select";
import { CASE_STATUSES, CASE_TYPES, PRIORITIES } from "@/lib/constants";
import type { SuiteOption } from "@/lib/suite-tree";

const ALL = "__all__";

export function useSearchUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

function FilterSelect({
  label,
  param,
  options,
}: {
  label: string;
  param: string;
  options: { value: string; label: string }[];
}) {
  const { params, update } = useSearchUpdater();
  const value = params.get(param) ?? ALL;
  return (
    <Select value={value} onValueChange={(v) => update({ [param]: v === ALL ? null : v })}>
      <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} size="sm" className="min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CaseFilters({ suites, users }: { suites: SuiteOption[]; users: { id: string; name: string }[] }) {
  const { params, update, pending } = useSearchUpdater();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  // Debounced search-as-you-type; Enter applies immediately.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) update({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "suite", "priority", "status", "type", "assignee"].some((k) => params.get(k));
  const archived = params.get("archived") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        role="search"
        className="relative w-full sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search by ID or title"
          placeholder="Search by ID or title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-7 pl-8"
        />
      </form>
      <SuiteSelect
        options={suites}
        value={params.get("suite") ?? ""}
        onChange={(v) => update({ suite: v || null })}
        allowNone
        noneLabel="All suites"
        size="sm"
        className="w-auto min-w-36"
      />
      <FilterSelect label="Priorities" param="priority" options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
      <FilterSelect label="Statuses" param="status" options={CASE_STATUSES.map((p) => ({ value: p, label: p }))} />
      <FilterSelect label="Types" param="type" options={CASE_TYPES.map((p) => ({ value: p, label: p }))} />
      <FilterSelect
        label="Assignees"
        param="assignee"
        options={[{ value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
      />
      <Button
        variant={archived ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={archived}
        onClick={() => update({ archived: archived ? null : "1" })}
      >
        <Archive aria-hidden /> {archived ? "Showing archived" : "Archived"}
      </Button>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            update({ q: null, suite: null, priority: null, status: null, type: null, assignee: null });
          }}
        >
          <X aria-hidden /> Clear filters
        </Button>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading results" />}
    </div>
  );
}
