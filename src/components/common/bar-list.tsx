/** Horizontal single-hue bar list with direct labels; the list itself is the table view. */
export function BarList({ items, label }: { items: { name: string; value: number }[]; label: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2" aria-label={label}>
      {items.map((i) => {
        const pct = total ? Math.round((i.value / total) * 100) : 0;
        return (
          <li key={i.name} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-sm" title={`${i.name}: ${i.value} (${pct}%)`}>
            <span className="truncate text-muted-foreground">{i.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(i.value / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">
              {i.value} <span className="text-xs text-muted-foreground">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
