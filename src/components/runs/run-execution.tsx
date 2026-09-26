"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, FileBarChart, Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PriorityBadge, RESULT_STYLE, ResultBadge, RunStatusBadge } from "@/components/common/badges";
import { RunCountsInline, RunProgressBar } from "./progress-bar";
import { EvidenceEditor, EvidenceList, type EvidenceDraft, type EvidenceView } from "./evidence";
import { deleteRun, recordResult, setRunStatus } from "@/server/actions/runs";
import { RESULT_STATUSES, type ResultStatus } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RunCaseView = {
  id: string;
  testCaseId: string | null;
  caseKey: string;
  title: string;
  suiteName: string;
  priority: string;
  preconditions: string;
  steps: { action: string; expectedResult: string }[];
  status: string;
  comment: string;
  bugRef: string;
  executedBy: string | null;
  executedAt: string | null;
  /** Newest first. The first entry is the current result. */
  history: { id: string; status: string; comment: string; bugRef: string; evidence: EvidenceView[]; by: string | null; at: string }[];
};

export type RunView = {
  id: string;
  title: string;
  description: string;
  status: string;
  owner: string | null;
  environment: string;
  buildVersion: string;
  releaseRef: string;
  executionDate: string | null;
  sourceSuites: string;
  createdAt: string;
  completedAt: string | null;
  cases: RunCaseView[];
};

const FILTERS = ["All", ...RESULT_STATUSES] as const;

export function RunExecution({ projectId, code, run }: { projectId: string; code: string; run: RunView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const selectedId = params.get("case") ?? run.cases[0]?.id;
  const current = run.cases.find((c) => c.id === selectedId) ?? run.cases[0];
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = run.status === "Completed";

  const counts = useMemo(() => {
    const c = { total: run.cases.length, Pass: 0, Fail: 0, Blocked: 0, "Not Run": 0 };
    for (const rc of run.cases) c[rc.status as ResultStatus]++;
    return c;
  }, [run.cases]);

  const visible = run.cases.filter((c) => filter === "All" || c.status === filter);
  const select = (id: string) => router.replace(`${pathname}?case=${id}`, { scroll: false });

  const afterSave = (advance: boolean) => {
    if (advance && current) {
      const idx = run.cases.findIndex((c) => c.id === current.id);
      const next = [...run.cases.slice(idx + 1), ...run.cases.slice(0, idx)].find((c) => c.status === "Not Run");
      if (next) select(next.id);
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 py-4">
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusBadge value={run.status} />
            <span className="text-sm text-muted-foreground">
              Started {formatDateTime(run.createdAt)}
              {run.completedAt && ` · Completed ${formatDateTime(run.completedAt)}`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/p/${code}/runs/${run.id}/report`}>
                  <FileBarChart aria-hidden /> Report & export
                </Link>
              </Button>
              {locked ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const r = await setRunStatus(projectId, run.id, "Active");
                    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
                  })}
                >
                  <RotateCcw aria-hidden /> Reopen run
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const r = await setRunStatus(projectId, run.id, "Completed");
                    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
                  })}
                >
                  <CheckCircle2 aria-hidden /> Complete run
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> Delete run
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6" data-testid="run-meta">
            {(
              [
                ["Environment", run.environment],
                ["Build / version", run.buildVersion],
                ["Release / ticket", run.releaseRef],
                ["Execution date", run.executionDate ? formatDate(run.executionDate) : ""],
                ["Tester", run.owner ?? ""],
                ["Suites", run.sourceSuites],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="truncate" title={v}>
                  {v || "—"}
                </dd>
              </div>
            ))}
          </dl>
          {run.description && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{run.description}</p>}
          <RunProgressBar counts={counts} />
          <div data-testid="run-counts">
            <RunCountsInline counts={counts} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap gap-1 border-b p-2" role="group" aria-label="Filter by result">
            {FILTERS.map((f) => (
              <Button key={f} size="xs" variant={filter === f ? "secondary" : "ghost"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f} {f === "All" ? counts.total : counts[f]}
              </Button>
            ))}
          </div>
          <ul className="max-h-[65vh] overflow-auto" aria-label="Cases in this run">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(c.id)}
                  aria-current={c.id === current?.id ? "true" : undefined}
                  data-testid="run-case-item"
                  className={cn(
                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                    c.id === current?.id && "bg-accent",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", RESULT_STYLE[c.status]?.dot)} aria-hidden />
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{c.caseKey}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="sr-only">Result: {c.status}</span>
                </button>
              </li>
            ))}
            {!visible.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No cases with this result.</li>}
          </ul>
        </Card>

        {current ? (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{current.caseKey}</span>
                  <PriorityBadge value={current.priority} />
                  <ResultBadge value={current.status} />
                  {current.testCaseId && (
                    <Link href={`/p/${code}/cases/${current.caseKey}`} className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Open test case <ExternalLink className="size-3" aria-hidden />
                    </Link>
                  )}
                </div>
                <CardTitle className="text-base" data-testid="run-case-title">
                  {current.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Test case definition (reusable)</span> · {current.suiteName} · as it was when this run
                  started. Editing the test case later does not change this run.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <section>
                  <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Preconditions</h3>
                  <p className="text-sm whitespace-pre-wrap">{current.preconditions || "None."}</p>
                </section>
                <section>
                  <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Steps</h3>
                  {current.steps.length ? (
                    <ol className="flex flex-col gap-2">
                      {current.steps.map((s, i) => (
                        <li key={i} className="grid gap-1 rounded-lg border p-2.5 text-sm md:grid-cols-[24px_1fr_1fr] md:gap-3">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          <span className="whitespace-pre-wrap">{s.action}</span>
                          <span className="whitespace-pre-wrap text-muted-foreground">
                            <span className="font-medium text-foreground md:hidden">Expected: </span>
                            {s.expectedResult || "—"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">No steps.</p>
                  )}
                </section>
              </CardContent>
            </Card>

            <ResultForm
              key={`${current.id}|${current.history[0]?.id ?? "none"}`}
              projectId={projectId}
              current={current}
              locked={locked}
              onSaved={afterSave}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Execution history (this run)</CardTitle>
              </CardHeader>
              <CardContent>
                {current.history.length ? (
                  <ol className="flex flex-col gap-2 text-sm" data-testid="exec-history">
                    {current.history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-start gap-2 border-b pb-2 last:border-0" data-testid="exec-entry">
                        <ResultBadge value={h.status} />
                        <span className="text-xs text-muted-foreground">
                          {h.by ?? "Unknown"} · {formatDateTime(h.at)}
                        </span>
                        {h.bugRef && <span className="text-xs">Defect: {h.bugRef}</span>}
                        {h.comment && <p className="w-full whitespace-pre-wrap text-muted-foreground">{h.comment}</p>}
                        <div className="w-full">
                          <EvidenceList items={h.evidence} empty="No evidence." />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No results recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">This run has no cases.</CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this test run?"
        description="All recorded results and execution history for this run will be permanently deleted. Test cases are not affected."
        onConfirm={async () => {
          const r = await deleteRun(projectId, run.id);
          if (r.ok) {
            toast.success(r.message);
            router.push(`/p/${code}/runs`);
            router.refresh();
          } else toast.error(r.error);
          return r.ok;
        }}
      />
    </div>
  );
}

/** Keyed by the saved result so it re-initializes after switching cases or saving. */
function ResultForm({
  projectId,
  current,
  locked,
  onSaved,
}: {
  projectId: string;
  current: RunCaseView;
  locked: boolean;
  onSaved: (advance: boolean) => void;
}) {
  const [status, setStatus] = useState<ResultStatus>(current.status as ResultStatus);
  const [comment, setComment] = useState(current.comment);
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [bugRef, setBugRef] = useState(current.bugRef);
  const latest = current.history[0];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(advance: boolean) {
    if (saving) return;
    const errs: Record<string, string> = {};
    evidence.forEach((e, i) => {
      if (!e.url.trim()) errs[`evidence.${i}.url`] = "Enter the evidence URL";
      else if (!/^https?:\/\/\S+$/i.test(e.url.trim())) errs[`evidence.${i}.url`] = "Enter a full http(s) URL";
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await recordResult(projectId, { runCaseId: current.id, status, comment, bugRef, evidence });
      if (!res.ok) {
        toast.error(res.error);
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])));
        return;
      }
      toast.success(res.message);
      onSaved(advance);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">This run: result &amp; evidence</CardTitle>
        <p className="text-xs text-muted-foreground">
          Saving records a new execution. Earlier executions and their evidence stay in the history below.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {locked && (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden /> This run is completed. Reopen it to record or change results.
          </p>
        )}
        <div role="radiogroup" aria-label="Result" className="flex flex-wrap gap-2">
          {RESULT_STATUSES.map((s) => {
            const st = RESULT_STYLE[s];
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                onClick={() => setStatus(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  on ? st.cls + " ring-2 ring-current/30" : "bg-background hover:bg-muted",
                )}
              >
                <st.Icon className="size-4" aria-hidden /> {s}
              </button>
            );
          })}
        </div>
        <Field id="exec-comment" label="Comment">
          <Textarea id="exec-comment" rows={3} value={comment} disabled={locked} onChange={(e) => setComment(e.target.value)} placeholder="What you observed" />
        </Field>
        {status === "Fail" && (
          <Field id="exec-bug" label="Defect reference" hint="Issue key or URL in your tracker. No tracker integration is configured.">
            <Input id="exec-bug" value={bugRef} disabled={locked} onChange={(e) => setBugRef(e.target.value)} placeholder="e.g. BUG-123" className="max-w-sm" />
          </Field>
        )}
        <section aria-labelledby="evidence-heading" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="evidence-heading" className="text-[13px] font-medium">
              Evidence for this execution
            </h3>
            {latest && latest.evidence.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={locked}
                onClick={() =>
                  setEvidence((prev) => [
                    ...prev,
                    ...latest.evidence.map((e) => ({ kind: e.kind as EvidenceDraft["kind"], label: e.label, url: e.url })),
                  ])
                }
              >
                <Copy aria-hidden /> Copy {latest.evidence.length} link(s) from latest execution
              </Button>
            )}
          </div>
          <EvidenceEditor items={evidence} onChange={setEvidence} errors={errors} disabled={locked} />
        </section>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)} disabled={locked || saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />} Save result
          </Button>
          <Button variant="outline" onClick={() => save(true)} disabled={locked || saving}>
            Save & next untested
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
