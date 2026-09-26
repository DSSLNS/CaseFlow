"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { autoMap, type ColumnMapping } from "@/lib/import/fields";
import type {
  CommitRequest,
  CommitResponse,
  DuplicateAction,
  ImportOptions,
  ParseResult,
  ValidateResponse,
} from "@/lib/import/types";
import type { SuiteOption } from "@/lib/suite-tree";
import { Stepper } from "./stepper";
import { UploadStep } from "./upload-step";
import { PreviewStep, Stat } from "./preview-step";
import { MappingStep } from "./mapping-step";
import { rowAction, ValidateStep } from "./validate-step";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function ImportWizard({ projectId, code, suites }: { projectId: string; code: string; suites: SuiteOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [options, setOptions] = useState<ImportOptions>({ defaultSuiteId: "", createMissingSuites: true, duplicateStrategy: "project_title" });
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [defaultAction, setDefaultAction] = useState<DuplicateAction>("skip");
  const [rowActions, setRowActions] = useState<Record<number, DuplicateAction>>({});
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [busy, setBusy] = useState<"parse" | "validate" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>("");

  const reset = () => {
    setStep(0);
    setFile(null);
    setParsed(null);
    setMapping([]);
    setValidation(null);
    setRowActions({});
    setResult(null);
    setError(null);
  };

  async function parse() {
    if (!file) return;
    setBusy("parse");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not parse the file.");
      const p = json as ParseResult;
      setParsed(p);
      setMapping(autoMap(p.headers));
      setValidation(null);
      setRowActions({});
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse the file.");
    } finally {
      setBusy(null);
    }
  }

  async function validate(p: ParseResult = parsed!) {
    setBusy("validate");
    setError(null);
    try {
      const v = await postJson<ValidateResponse>("/api/import/validate", {
        projectId,
        headers: p.headers,
        rows: p.rows,
        mapping,
        options,
        fileHash: p.fileHash,
      });
      setValidation(v);
      setStep(3);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed.");
      toast.error(e instanceof Error ? e.message : "Validation failed.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!parsed || !validation || busy) return;
    setBusy("commit");
    setError(null);
    try {
      const body: CommitRequest = {
        projectId,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping,
        options,
        fileHash: parsed.fileHash,
        idempotencyKey: idempotencyKey.current,
        filename: parsed.filename,
        fileSize: parsed.fileSize,
        blankRows: parsed.blankRows.length,
        defaultDuplicateAction: defaultAction,
        rowActions,
      };
      const r = await postJson<CommitResponse>("/api/import/commit", body);
      setResult(r);
      setStep(5);
      toast.success(r.replayed ? "This import was already submitted; showing its result." : "Import finished");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  }

  const planned = validation
    ? validation.rows.reduce(
        (acc, r) => {
          acc[rowAction(r, defaultAction, rowActions)]++;
          return acc;
        },
        { create: 0, update: 0, skip: 0, fail: 0 },
      )
    : null;

  return (
    <Card>
      <CardContent>
        <Stepper current={step} />
        {step === 0 && <UploadStep file={file} onFile={(f) => { setFile(f); setError(null); }} onParse={parse} parsing={busy === "parse"} error={error} />}
        {step === 1 && parsed && <PreviewStep parsed={parsed} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && parsed && (
          <MappingStep
            parsed={parsed}
            mapping={mapping}
            onMapping={setMapping}
            options={options}
            onOptions={setOptions}
            suites={suites}
            onBack={() => setStep(1)}
            onNext={() => validate()}
            validating={busy === "validate"}
            error={error}
          />
        )}
        {step === 3 && parsed && validation && (
          <ValidateStep
            parsed={parsed}
            mapping={mapping}
            validation={validation}
            defaultAction={defaultAction}
            onDefaultAction={setDefaultAction}
            rowActions={rowActions}
            onRowAction={(row, a) => setRowActions((p) => ({ ...p, [row]: a }))}
            onEditRow={(rowNumber, cells) => {
              const next = { ...parsed, rows: parsed.rows.map((r) => (r.rowNumber === rowNumber ? { rowNumber, cells } : r)) };
              setParsed(next);
              void validate(next);
            }}
            revalidating={busy === "validate"}
            onBack={() => setStep(2)}
            onNext={() => {
              idempotencyKey.current = crypto.randomUUID();
              setStep(4);
            }}
          />
        )}
        {step === 4 && parsed && validation && planned && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Review the summary. Nothing is written until you confirm. The import runs in a single transaction: if anything fails,
              no test cases are changed.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Rows detected" value={validation.summary.totalRows} />
              <Stat label="Valid rows" value={validation.summary.validRows} tone="good" />
              <Stat label="Invalid rows (will fail)" value={validation.summary.invalidRows} tone={validation.summary.invalidRows ? "bad" : undefined} />
              <Stat label="Duplicates" value={validation.summary.duplicates} tone={validation.summary.duplicates ? "warn" : undefined} />
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-semibold">Expected result</h3>
              <ul className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4" data-testid="planned-summary">
                <li><span className="text-2xl font-semibold tabular-nums" data-testid="plan-create">{planned.create}</span> to create</li>
                <li><span className="text-2xl font-semibold tabular-nums" data-testid="plan-update">{planned.update}</span> to update</li>
                <li><span className="text-2xl font-semibold tabular-nums" data-testid="plan-skip">{planned.skip}</span> to skip</li>
                <li><span className="text-2xl font-semibold tabular-nums" data-testid="plan-fail">{planned.fail}</span> will fail</li>
              </ul>
              {validation.summary.suitesToCreate.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">New suites: {validation.summary.suitesToCreate.join(", ")}</p>
              )}
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={busy === "commit"}>
                Back
              </Button>
              <Button onClick={commit} disabled={busy === "commit" || planned.create + planned.update === 0}>
                {busy === "commit" && <Loader2 className="animate-spin" aria-hidden />}
                Confirm import ({planned.create + planned.update} test case{planned.create + planned.update === 1 ? "" : "s"})
              </Button>
            </div>
            {planned.create + planned.update === 0 && (
              <p className="-mt-2 text-right text-xs text-muted-foreground">No rows will be created or updated with the current choices.</p>
            )}
          </div>
        )}
        {step === 5 && result && (
          <div className="flex flex-col gap-4" data-testid="import-result">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="size-6 text-amber-600" aria-hidden />
              )}
              <h2 className="text-lg font-semibold">
                Import complete{result.failed ? " with failed rows" : ""}
                {result.replayed && " (already submitted)"}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Created" value={result.created} tone="good" testId="result-created" />
              <Stat label="Updated" value={result.updated} testId="result-updated" />
              <Stat label="Skipped" value={result.skipped} testId="result-skipped" />
              <Stat label="Failed" value={result.failed} tone={result.failed ? "bad" : undefined} testId="result-failed" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/p/${code}/import/${result.batchId}`}>View row details</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/p/${code}/cases?sort=id&dir=desc`}>View test cases</Link>
              </Button>
              <Button variant="ghost" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
