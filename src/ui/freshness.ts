import type { Note } from "../content/types";
import type { siteConfig } from "../site.config";
const DAY = 86400000;
type Status =
  | { kind: "review"; date: string; days: number }
  | { kind: "stale"; date: string; days: number; threshold: number };
function timestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === value
    ? ms
    : null;
}
export type FreshnessNote = Pick<
  Note,
  | "source"
  | "date"
  | "updated"
  | "reviewed"
  | "reviewAfter"
  | "stale"
  | "staleAfter"
>;
// Deterministic at build time; no automatic remote checks.
export function freshnessStatus(
  note: FreshnessNote,
  config: typeof siteConfig.freshness,
  asOf: string,
): Status | null {
  if (!config?.enabled || note.stale === false) return null;
  const today = timestamp(asOf);
  if (today === null) throw new Error("Invalid freshness evaluation date");
  if (note.reviewAfter) {
    const due = timestamp(note.reviewAfter);
    if (due === null) throw new Error("Invalid reviewAfter");
    return today > due
      ? {
          kind: "review",
          date: note.reviewAfter,
          days: Math.floor((today - due) / DAY),
        }
      : null;
  }
  if (
    !note.stale &&
    note.staleAfter == null &&
    !config.checkPaths.some((path) => note.source?.startsWith(path))
  )
    return null;
  const threshold = note.staleAfter ?? config.staleThreshold;
  if (!Number.isInteger(threshold) || threshold < 0)
    throw new Error("Invalid staleAfter threshold");
  const date = note.reviewed || note.updated || note.date;
  if (!date) return null;
  const updated = timestamp(date);
  if (updated === null) throw new Error("Invalid freshness reference date");
  const days = Math.floor((today - updated) / DAY);
  return days > threshold ? { kind: "stale", date, days, threshold } : null;
}
