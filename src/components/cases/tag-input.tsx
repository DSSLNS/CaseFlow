"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      <ul className="contents" aria-label="Tags">
        {value.map((t) => (
          <li key={t} className="inline-flex items-center gap-0.5 rounded bg-secondary py-0.5 pr-0.5 pl-1.5 text-xs" data-testid="tag-chip">
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="rounded p-0.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Remove tag ${t}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          if (/[,;]/.test(e.target.value)) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        placeholder={value.length ? "" : "Type and press Enter"}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}
