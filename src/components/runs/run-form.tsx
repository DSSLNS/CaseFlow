"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { PriorityBadge } from "@/components/common/badges";
import { NONE } from "@/components/common/suite-select";
import { createRun } from "@/server/actions/runs";
import { descendantIds, type SuiteOption } from "@/lib/suite-tree";

type CaseLite = { id: string; key: string; title: string; suiteId: string; priority: string };
type Mode = "all" | "suites" | "cases";

export function RunForm({
  projectId,
  code,
  cases,
  suites,
  users,
  currentUserId,
  preselected,
  defaultTitle,
  today,
}: {
  projectId: string;
  code: string;
  cases: CaseLite[];
  suites: SuiteOption[];
  users: { id: string; name: string }[];
  currentUserId: string;
  preselected: string[];
  defaultTitle: string;
  today: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [environment, setEnvironment] = useState("");
  const [buildVersion, setBuildVersion] = useState("");
  const [releaseRef, setReleaseRef] = useState("");
  const [executionDate, setExecutionDate] = useState(today);
  const [mode, setMode] = useState<Mode>(preselected.length ? "cases" : "all");
  const [suiteSel, setSuiteSel] = useState<Set<string>>(new Set());
  const [caseSel, setCaseSel] = useState<Set<string>>(new Set(preselected.filter((id) => cases.some((c) => c.id === id))));
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const suiteCaseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of suiteSel) for (const d of descendantIds(suites, s)) ids.add(d);
    return cases.filter((c) => ids.has(c.suiteId)).map((c) => c.id);
  }, [suiteSel, suites, cases]);

  const selectedIds = mode === "all" ? cases.map((c) => c.id) : mode === "suites" ? suiteCaseIds : [...caseSel];
  const countBySuite = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of suites) {
      const d = new Set(descendantIds(suites, s.id));
      m.set(s.id, cases.filter((c) => d.has(c.suiteId)).length);
    }
    return m;
  }, [suites, cases]);
  const visibleCases = cases.filter(
    (c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()) || c.key.toLowerCase().includes(filter.toLowerCase()),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Run name is required";
    if (!selectedIds.length) errs.caseIds = "Select at least one test case";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const res = await createRun({
        projectId,
        title,
        description,
        ownerId,
        environment,
        buildVersion,
        releaseRef,
        executionDate,
        suiteIds: mode === "suites" ? [...suiteSel] : [],
        caseIds: selectedIds,
      });
      if (!res.ok) {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])));
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.push(`/p/${code}/runs/${res.data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Run details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field id="run-title" label="Run name" required error={errors.title}>
            <Input id="run-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title || undefined} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="run-environment" label="Environment">
              <Input id="run-environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="e.g. Staging" list="env-options" />
              <datalist id="env-options">
                <option value="Development" />
                <option value="QA" />
                <option value="Staging" />
                <option value="Production" />
              </datalist>
            </Field>
            <Field id="run-build" label="Build / version">
              <Input id="run-build" value={buildVersion} onChange={(e) => setBuildVersion(e.target.value)} placeholder="e.g. 2.4.1 (build 512)" />
            </Field>
            <Field id="run-release" label="Release / ticket">
              <Input id="run-release" value={releaseRef} onChange={(e) => setReleaseRef(e.target.value)} placeholder="e.g. REL-2.4" />
            </Field>
            <Field id="run-date" label="Execution date" error={errors.executionDate}>
              <Input id="run-date" type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} />
            </Field>
          </div>
          <Field id="run-owner" label="Tester">
            <Select value={ownerId || NONE} onValueChange={(v) => setOwnerId(v === NONE ? "" : v)}>
              <SelectTrigger id="run-owner" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not assigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="run-description" label="Notes">
            <Textarea id="run-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="font-semibold tabular-nums" data-testid="run-selected-count">
              {selectedIds.length}
            </span>{" "}
            test case{selectedIds.length === 1 ? "" : "s"} will be included.
            {errors.caseIds && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.caseIds}
              </p>
            )}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Start test run
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Test cases</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex flex-wrap gap-4" aria-label="Case selection">
            {(
              [
                ["all", `All active cases (${cases.length})`],
                ["suites", "Select suites"],
                ["cases", "Select specific cases"],
              ] as const
            ).map(([v, l]) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`mode-${v}`} />
                <Label htmlFor={`mode-${v}`}>{l}</Label>
              </div>
            ))}
          </RadioGroup>

          {mode === "suites" && (
            <ul className="max-h-[60vh] overflow-auto rounded-lg border p-2" aria-label="Suites">
              {suites.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1" style={{ paddingLeft: s.depth * 18 }}>
                  <Checkbox
                    id={`suite-${s.id}`}
                    checked={suiteSel.has(s.id)}
                    onCheckedChange={(v) =>
                      setSuiteSel((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  <Label htmlFor={`suite-${s.id}`} className="font-normal">
                    {s.name}
                  </Label>
                  <span className="text-xs text-muted-foreground">({countBySuite.get(s.id) ?? 0})</span>
                </li>
              ))}
            </ul>
          )}

          {mode === "cases" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    aria-label="Filter cases"
                    placeholder="Filter by ID or title"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCaseSel(new Set([...caseSel, ...visibleCases.map((c) => c.id)]))}>
                  Select visible
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCaseSel(new Set())}>
                  Clear
                </Button>
              </div>
              <ul className="max-h-[60vh] divide-y overflow-auto rounded-lg border" aria-label="Test cases">
                {visibleCases.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Checkbox
                      id={`case-${c.id}`}
                      checked={caseSel.has(c.id)}
                      onCheckedChange={(v) =>
                        setCaseSel((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <Label htmlFor={`case-${c.id}`} className="flex min-w-0 flex-1 items-center gap-2 font-normal">
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{c.key}</span>
                      <span className="truncate">{c.title}</span>
                    </Label>
                    <PriorityBadge value={c.priority} />
                  </li>
                ))}
                {!visibleCases.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No cases match.</li>}
              </ul>
            </>
          )}
          {mode === "all" && (
            <p className="text-sm text-muted-foreground">Every non-archived test case in this project will be included.</p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
