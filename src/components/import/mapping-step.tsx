"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { SuiteSelect } from "@/components/common/suite-select";
import { IMPORT_FIELDS, mappingProblems, type ColumnMapping, type MappingTarget } from "@/lib/import/fields";
import type { DuplicateStrategy, ImportOptions, ParseResult } from "@/lib/import/types";
import type { SuiteOption } from "@/lib/suite-tree";

const UNSET = "__unset__";

export function MappingStep({
  parsed,
  mapping,
  onMapping,
  options,
  onOptions,
  suites,
  onBack,
  onNext,
  validating,
  error,
}: {
  parsed: ParseResult;
  mapping: ColumnMapping;
  onMapping: (m: ColumnMapping) => void;
  options: ImportOptions;
  onOptions: (o: ImportOptions) => void;
  suites: SuiteOption[];
  onBack: () => void;
  onNext: () => void;
  validating: boolean;
  error: string | null;
}) {
  const problems = mappingProblems(mapping);
  const undecided = mapping.map((m, i) => (m === "" ? i : -1)).filter((i) => i >= 0);
  const ignored = mapping.map((m, i) => (m === "ignore" ? i : -1)).filter((i) => i >= 0);
  const suiteMapped = mapping.includes("suite");
  const needsDefaultSuite = !options.defaultSuiteId;
  const sample = (i: number) =>
    parsed.rows
      .map((r) => r.cells[i])
      .filter((v) => v?.trim())
      .slice(0, 2)
      .map((v) => (v.length > 60 ? `${v.slice(0, 60)}…` : v))
      .join(" · ");

  const set = (i: number, v: MappingTarget) => onMapping(mapping.map((m, j) => (j === i ? v : m)));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        We suggested a mapping from your column headers. Review it and map or explicitly ignore every column. Steps and Expected
        Result can be mapped to several columns (e.g. “Step 1”, “Step 2”), which are paired in column order.
      </p>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm" aria-label="Column mapping">
          <thead className="bg-muted/80 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">File column</th>
              <th scope="col" className="px-3 py-2">Sample values</th>
              <th scope="col" className="w-64 px-3 py-2">Import as</th>
            </tr>
          </thead>
          <tbody>
            {parsed.headers.map((h, i) => (
              <tr key={i} className="border-t" data-testid="mapping-row">
                <td className="px-3 py-2 font-medium">{h}</td>
                <td className="max-w-[320px] truncate px-3 py-2 text-xs text-muted-foreground">{sample(i) || "—"}</td>
                <td className="px-3 py-2">
                  <Select value={mapping[i] || UNSET} onValueChange={(v) => set(i, v === UNSET ? "" : (v as MappingTarget))}>
                    <SelectTrigger aria-label={`Import column ${h} as`} className="w-full" data-state-mapping={mapping[i] || "unset"} aria-invalid={mapping[i] === "" || undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-72">
                      <SelectItem value={UNSET} disabled>
                        Choose a field…
                      </SelectItem>
                      <SelectItem value="ignore">Don&apos;t import this column</SelectItem>
                      {IMPORT_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {undecided.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {undecided.length} column(s) are not mapped: <strong>{undecided.map((i) => parsed.headers[i]).join(", ")}</strong>. Their
              data will not be imported unless you map them.
            </span>
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={() => onMapping(mapping.map((m) => (m === "" ? "ignore" : m)))}>
              Ignore these columns
            </Button>
          </div>
        </div>
      )}
      {ignored.length > 0 && undecided.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Not imported: {ignored.map((i) => parsed.headers[i]).join(", ")}.
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="list-disc rounded-md border border-destructive/30 bg-destructive/5 py-2 pr-3 pl-8 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
        <Field
          id="default-suite"
          label="Default suite"
          required={!suiteMapped}
          hint={suiteMapped ? "Used for rows whose Suite cell is empty." : "All rows go into this suite."}
        >
          <SuiteSelect id="default-suite" options={suites} value={options.defaultSuiteId} onChange={(v) => onOptions({ ...options, defaultSuiteId: v })} allowNone noneLabel="No default" />
        </Field>
        <Field id="dup-strategy" label="Detect duplicates by" hint="Existing cases matching this rule are flagged for review.">
          <Select value={options.duplicateStrategy} onValueChange={(v) => onOptions({ ...options, duplicateStrategy: v as DuplicateStrategy })}>
            <SelectTrigger id="dup-strategy" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project_title">Same title in this project</SelectItem>
              <SelectItem value="suite_title">Same title in the same suite</SelectItem>
              <SelectItem value="none">Don&apos;t check for duplicates</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Unknown suites</span>
          <div className="flex items-start gap-2">
            <Checkbox
              id="create-suites"
              checked={options.createMissingSuites}
              disabled={!suiteMapped}
              onCheckedChange={(v) => onOptions({ ...options, createMissingSuites: v === true })}
            />
            <Label htmlFor="create-suites" className="leading-snug font-normal">
              Create suites that don&apos;t exist yet (use “Parent &gt; Child” for nesting)
            </Label>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={validating || problems.length > 0 || undecided.length > 0 || (!suiteMapped && needsDefaultSuite)}
        >
          {validating && <Loader2 className="animate-spin" aria-hidden />}
          Validate rows
        </Button>
      </div>
      {!suiteMapped && needsDefaultSuite && (
        <p className="-mt-3 text-right text-xs text-muted-foreground">Choose a default suite, or map a Suite column.</p>
      )}
    </div>
  );
}
