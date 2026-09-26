import { RESULT_STYLE } from "@/components/common/badges";
import type { RunCounts } from "@/server/services/runs";
import { cn } from "@/lib/utils";

const ORDER = ["Pass", "Fail", "Blocked", "Not Run"] as const;

export function RunProgressBar({ counts, className }: { counts: RunCounts; className?: string }) {
  const done = counts.total - counts["Not Run"];
  const pct = counts.total ? Math.round((done / counts.total) * 100) : 0;
  const label = ORDER.map((s) => `${counts[s]} ${s}`).join(", ");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${pct}% executed: ${label}`}
      >
        {ORDER.filter((s) => s !== "Not Run").map((s) =>
          counts[s] ? (
            <div key={s} className={RESULT_STYLE[s].dot} style={{ width: `${(counts[s] / counts.total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function RunCountsInline({ counts }: { counts: RunCounts }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={cn("size-2 rounded-full", RESULT_STYLE[s].dot)} aria-hidden />
          <span className="tabular-nums text-foreground">{counts[s]}</span> {s}
        </span>
      ))}
    </div>
  );
}
