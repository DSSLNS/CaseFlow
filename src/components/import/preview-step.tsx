import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResult } from "@/lib/import/types";

export function PreviewStep({ parsed, onBack, onNext }: { parsed: ParseResult; onBack: () => void; onNext: () => void }) {
  const preview = parsed.rows.slice(0, 10);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Data rows detected" value={parsed.rows.length} testId="preview-rows" />
        <Stat label="Columns" value={parsed.headers.length} />
        <Stat label="Blank rows (ignored)" value={parsed.blankRows.length} testId="preview-blank" />
        <Stat label="Malformed rows" value={parsed.malformedRows.length} tone={parsed.malformedRows.length ? "warn" : undefined} testId="preview-malformed" />
      </div>
      <p className="text-xs text-muted-foreground">
        {parsed.format.toUpperCase()} file{parsed.sheetName ? `, sheet “${parsed.sheetName}”` : ""}. Nothing has been imported yet.
      </p>
      {parsed.blankRows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Blank rows {parsed.blankRows.slice(0, 20).join(", ")}
          {parsed.blankRows.length > 20 ? "…" : ""} contain no values and will not be imported.
        </p>
      )}
      {parsed.malformedRows.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden /> Some rows look malformed and will be flagged in validation:
          </div>
          <ul className="mt-1 list-disc pl-6">
            {parsed.malformedRows.slice(0, 10).map((m) => (
              <li key={m.rowNumber}>
                Row {m.rowNumber}: {m.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-xs" aria-label="File preview">
          <thead className="bg-muted/80 text-left">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-muted-foreground">Row</th>
              {parsed.headers.map((h, i) => (
                <th key={i} scope="col" className="px-2 py-1.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.rowNumber} className="border-t align-top">
                <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="max-w-[240px] px-2 py-1.5">
                    <div className="line-clamp-3 whitespace-pre-wrap">{c}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parsed.rows.length > preview.length && (
        <p className="text-xs text-muted-foreground">Showing the first {preview.length} of {parsed.rows.length} rows.</p>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!parsed.rows.length}>
          Continue to mapping
        </Button>
      </div>
    </div>
  );
}

export function Stat({ label, value, tone, testId }: { label: string; value: number | string; tone?: "warn" | "bad" | "good"; testId?: string }) {
  return (
    <div
      className={
        "rounded-lg border px-3 py-2 " +
        (tone === "warn" ? "border-amber-300 bg-amber-50" : tone === "bad" ? "border-red-200 bg-red-50" : tone === "good" ? "border-emerald-200 bg-emerald-50" : "")
      }
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
