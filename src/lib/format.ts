import { format, formatDistanceToNow } from "date-fns";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy");
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy HH:mm");
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function caseKey(code: string, number: number): string {
  return `${code}-${number}`;
}

/** Parses "WEB-12" into its number for the given project code. */
export function parseCaseKey(key: string, code: string): number | null {
  const m = key.trim().toUpperCase().match(/^([A-Z0-9]+)-(\d+)$/);
  if (!m || m[1] !== code.toUpperCase()) return null;
  return Number(m[2]);
}
