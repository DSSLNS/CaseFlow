"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UploadStep({
  file,
  onFile,
  onParse,
  parsing,
  error,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onParse: () => void;
  parsing: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setLocalError(name.endsWith(".xls") ? "Legacy .xls is not supported. Save the file as .xlsx or .csv." : "Only .csv and .xlsx files are accepted.");
      return;
    }
    if (f.size > MAX_IMPORT_FILE_BYTES) {
      setLocalError(`The file is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_IMPORT_FILE_BYTES)}.`);
      return;
    }
    setLocalError(null);
    onFile(f);
  };

  // A file chosen before hydration never reaches onChange; pick it up on mount.
  useEffect(() => {
    const early = inputRef.current?.files?.[0];
    if (early) {
      accept(early);
      if (inputRef.current) inputRef.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          drag ? "border-primary bg-accent" : "border-border bg-muted/30",
        )}
        data-testid="dropzone"
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Drag and drop a file here</p>
        <p className="text-xs text-muted-foreground">
          CSV (UTF-8) or Excel .xlsx · up to {formatBytes(MAX_IMPORT_FILE_BYTES)} · up to {MAX_IMPORT_ROWS.toLocaleString()} rows. The first
          non-empty row must be the header.
        </p>
        <input
          ref={inputRef}
          id="import-file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" className="mt-2" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <label htmlFor="import-file" className="sr-only">
          Choose a CSV or XLSX file
        </label>
      </div>

      {(localError || error) && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {localError ?? error}
        </p>
      )}

      {file && (
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2" data-testid="selected-file">
          <FileSpreadsheet className="size-5 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => onFile(null)}>
            <X />
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onParse} disabled={!file || parsing}>
          {parsing && <Loader2 className="animate-spin" aria-hidden />}
          Parse and preview
        </Button>
      </div>
    </div>
  );
}
