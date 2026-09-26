/**
 * Parses a human duration into minutes. Accepts "45", "45m", "1h", "1h 30m",
 * "1.5h", "2h15m". Returns null for blank input and undefined when unparseable.
 */
export function parseEstimate(input: string | null | undefined): number | null | undefined {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?$/);
  if (!match || (!match[1] && !match[2])) return undefined;
  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
  return minutes;
}

export function formatEstimate(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
