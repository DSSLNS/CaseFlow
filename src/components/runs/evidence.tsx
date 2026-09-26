"use client";

import { ExternalLink, FileVideo, FileText, Image as ImageIcon, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVIDENCE_KINDS } from "@/lib/validation";

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type EvidenceDraft = { kind: EvidenceKind; label: string; url: string };
export type EvidenceView = { id: string; kind: string; label: string; url: string; provider: string };

export const KIND_LABEL: Record<string, string> = {
  screenshot: "Screenshot",
  recording: "Screen recording",
  log: "Log / report",
  link: "Supporting link",
};
const KIND_ICON: Record<string, typeof Link2> = { screenshot: ImageIcon, recording: FileVideo, log: FileText, link: Link2 };

export function EvidenceList({ items, empty = "No evidence attached." }: { items: EvidenceView[]; empty?: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1" data-testid="evidence-list">
      {items.map((e) => {
        const Icon = KIND_ICON[e.kind] ?? Link2;
        return (
          <li key={e.id} className="flex min-w-0 items-center gap-2 text-sm">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABEL[e.kind] ?? e.kind}:</span>
            <a
              href={e.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline"
              title={e.url}
            >
              <span className="truncate">{e.label || e.url}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function EvidenceEditor({
  items,
  onChange,
  errors,
  disabled,
}: {
  items: EvidenceDraft[];
  onChange: (items: EvidenceDraft[]) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const set = (i: number, patch: Partial<EvidenceDraft>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[170px_1fr_1.4fr_auto]" data-testid="evidence-row">
          <Select value={it.kind} onValueChange={(v) => set(i, { kind: v as EvidenceKind })} disabled={disabled}>
            <SelectTrigger aria-label={`Evidence ${i + 1} type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label={`Evidence ${i + 1} label`} placeholder="Label (optional)" value={it.label} disabled={disabled} onChange={(e) => set(i, { label: e.target.value })} />
          <div className="flex flex-col gap-1">
            <Input
              aria-label={`Evidence ${i + 1} URL`}
              type="url"
              placeholder="https://drive.google.com/…"
              value={it.url}
              disabled={disabled}
              aria-invalid={!!errors[`evidence.${i}.url`] || undefined}
              onChange={(e) => set(i, { url: e.target.value })}
            />
            {errors[`evidence.${i}.url`] && (
              <p role="alert" className="text-xs text-destructive">
                {errors[`evidence.${i}.url`]}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove evidence ${i + 1}`} disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...items, { kind: "screenshot", label: "", url: "" }])}>
          <Plus aria-hidden /> Add evidence link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste links to screenshots, recordings or logs stored elsewhere (e.g. Google Drive). Links keep the storage&apos;s own sharing
        permissions; CaseFlow does not upload or make files public.
      </p>
    </div>
  );
}
