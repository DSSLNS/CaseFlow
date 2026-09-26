"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { FIELD_LABEL, type ColumnMapping, type ImportFieldKey } from "@/lib/import/fields";
import type { DuplicateAction, ParseResult, ValidateResponse, ValidatedRow } from "@/lib/import/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Stat } from "./preview-step";

type Filter = "all" | "errors" | "warnings" | "duplicates" | "valid";

export function rowAction(r: ValidatedRow, def: DuplicateAction, perRow: Record<number, DuplicateAction>): "create" | "update" | "skip" | "fail" {
  if (!r.valid) return "fail";
  if (r.duplicate) {
    const a = perRow[r.rowNumber] ?? def;
    if (a === "update" && r.duplicateOfRow !== undefined) return "skip";
    return a;
  }
  if (r.duplicateOfRow !== undefined) return perRow[r.rowNumber] === "skip" ? "skip" : "create";
  return "create";
}

function csvEscape(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ValidateStep({
  parsed,
  mapping,
  validation,
  defaultAction,
  onDefaultAction,
  rowActions,
  onRowAction,
  onEditRow,
  revalidating,
  onBack,
  onNext,
}: {
  parsed: ParseResult;
  mapping: ColumnMapping;
  validation: ValidateResponse;
  defaultAction: DuplicateAction;
  onDefaultAction: (a: DuplicateAction) => void;
  rowActions: Record<number, DuplicateAction>;
  onRowAction: (row: number, a: DuplicateAction) => void;
  onEditRow: (row: number, cells: string[]) => void;
  revalidating: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ rowNumber: number; cells: string[] } | null>(null);
  const { rows, summary, previousImports } = validation;
  const existingDupes = rows.filter((r) => r.duplicate).length;

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        filter === "all"
          ? true
          : filter === "errors"
            ? !r.valid
            : filter === "warnings"
              ? r.warnings.length > 0
              : filter === "duplicates"
                ? r.duplicate || r.duplicateOfRow !== undefined
                : r.valid,
      ),
    [rows, filter],
  );

  const downloadReport = () => {
    const lines = [["Row", "Title", "Result", "Planned action", "Errors", "Warnings", "Duplicate of"].join(",")];
    for (const r of rows) {
      lines.push(
        [
          String(r.rowNumber),
          r.data.title,
          r.valid ? "Valid" : "Invalid",
          rowAction(r, defaultAction, rowActions),
          r.errors.map((e) => `${e.field}: ${e.message}`).join(" | "),
          r.warnings.map((e) => `${e.field}: ${e.message}`).join(" | "),
          r.duplicate?.key ?? (r.duplicateOfRow ? `row ${r.duplicateOfRow}` : ""),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${parsed.filename.replace(/\.[^.]+$/, "")}-validation-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const mappedCols = mapping.map((m, i) => ({ m, i })).filter(({ m }) => m && m !== "ignore") as { m: ImportFieldKey; i: number }[];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rows detected" value={summary.totalRows} testId="val-total" />
        <Stat label="Valid" value={summary.validRows} tone="good" testId="val-valid" />
        <Stat label="Invalid" value={summary.invalidRows} tone={summary.invalidRows ? "bad" : undefined} testId="val-invalid" />
        <Stat label="Possible duplicates" value={summary.duplicates} tone={summary.duplicates ? "warn" : undefined} testId="val-duplicates" />
        <Stat label="Blank rows ignored" value={parsed.blankRows.length} />
      </div>

      {previousImports.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="previous-import-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            This exact file was already imported into this project on {formatDateTime(previousImports[0].createdAt)} (
            {previousImports[0].createdCount} created). Review duplicate handling below before importing again.
          </span>
        </div>
      )}
      {summary.suitesToCreate.length > 0 && (
        <p className="text-sm text-muted-foreground">
          New suites to be created: <strong>{summary.suitesToCreate.join(", ")}</strong>
        </p>
      )}

      {existingDupes > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <label htmlFor="dup-default" className="text-sm font-medium">
            For rows matching existing test cases ({existingDupes}):
          </label>
          <Select value={defaultAction} onValueChange={(v) => onDefaultAction(v as DuplicateAction)}>
            <SelectTrigger id="dup-default" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip (keep existing case)</SelectItem>
              <SelectItem value="update">Update existing case with file values</SelectItem>
              <SelectItem value="create">Import as a new case anyway</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">You can override individual rows in the table.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ["all", `All (${rows.length})`],
            ["errors", `Errors (${summary.invalidRows})`],
            ["warnings", `Warnings (${rows.filter((r) => r.warnings.length).length})`],
            ["duplicates", `Duplicates (${summary.duplicates})`],
            ["valid", `Valid (${summary.validRows})`],
          ] as const
        ).map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "secondary" : "ghost"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={downloadReport}>
          <Download aria-hidden /> Download validation report
        </Button>
      </div>

      <div className="max-h-[55vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[860px] text-sm" aria-label="Validation results">
          <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 px-3 py-2">Row</th>
              <th scope="col" className="px-2 py-2">Title</th>
              <th scope="col" className="px-2 py-2">Suite</th>
              <th scope="col" className="w-14 px-2 py-2">Steps</th>
              <th scope="col" className="px-2 py-2">Issues</th>
              <th scope="col" className="w-56 px-2 py-2">Action</th>
              <th scope="col" className="w-12 px-2 py-2"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const action = rowAction(r, defaultAction, rowActions);
              return (
                <tr key={r.rowNumber} className={cn("border-t align-top", !r.valid && "bg-red-50/60")} data-testid="validation-row">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                  <td className="max-w-[240px] px-2 py-2">
                    <span className="line-clamp-2">{r.data.title || <em className="text-muted-foreground">(no title)</em>}</span>
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-2 text-muted-foreground">
                    {r.data.suitePath?.join(" > ") ?? "(default)"}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{r.data.steps.length}</td>
                  <td className="px-2 py-2 text-xs">
                    <ul className="flex flex-col gap-0.5">
                      {r.errors.map((e, i) => (
                        <li key={`e${i}`} className="text-destructive">
                          <strong>{FIELD_LABEL[e.field as ImportFieldKey] ?? "Row"}:</strong> {e.message}
                        </li>
                      ))}
                      {r.warnings.map((w, i) => (
                        <li key={`w${i}`} className="text-amber-700">
                          {w.message}
                        </li>
                      ))}
                      {r.duplicate && (
                        <li className="text-amber-700">
                          Matches existing {r.duplicate.key}: “{r.duplicate.title}”
                        </li>
                      )}
                      {r.valid && !r.warnings.length && !r.duplicate && <li className="text-emerald-700">Ready to import</li>}
                    </ul>
                  </td>
                  <td className="px-2 py-2">
                    {!r.valid ? (
                      <span className="text-xs text-destructive">Will fail — fix or skip</span>
                    ) : r.duplicate || r.duplicateOfRow !== undefined ? (
                      <Select value={action === "fail" ? "skip" : action} onValueChange={(v) => onRowAction(r.rowNumber, v as DuplicateAction)}>
                        <SelectTrigger size="sm" className="w-full" aria-label={`Action for row ${r.rowNumber}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          {r.duplicate && <SelectItem value="update">Update {r.duplicate.key}</SelectItem>}
                          <SelectItem value="create">Import as new</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">Create</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit row ${r.rowNumber}`}
                      onClick={() => {
                        const src = parsed.rows.find((x) => x.rowNumber === r.rowNumber);
                        if (src) setEditing({ rowNumber: r.rowNumber, cells: [...src.cells] });
                      }}
                    >
                      <Pencil />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No rows in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to mapping
        </Button>
        <Button onClick={onNext} disabled={revalidating}>
          Review summary
        </Button>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit row {editing?.rowNumber}</DialogTitle>
            <DialogDescription>
              Corrections apply to this import only; your source file is not changed. Rows are re-validated after saving.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="flex flex-col gap-3">
              {mappedCols.map(({ m, i }) => (
                <Field key={i} id={`edit-${i}`} label={`${FIELD_LABEL[m]} (column “${parsed.headers[i]}”)`}>
                  <Textarea
                    id={`edit-${i}`}
                    rows={m === "steps" || m === "expectedResult" || m === "preconditions" || m === "description" ? 3 : 1}
                    className="min-h-9"
                    value={editing.cells[i] ?? ""}
                    onChange={(e) => setEditing({ ...editing, cells: editing.cells.map((c, j) => (j === i ? e.target.value : c)) })}
                  />
                </Field>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={revalidating}
              onClick={() => {
                if (editing) onEditRow(editing.rowNumber, editing.cells);
                setEditing(null);
              }}
            >
              {revalidating && <Loader2 className="animate-spin" aria-hidden />}
              Save and re-validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
