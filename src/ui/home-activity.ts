import type { CatalogNote } from "./types";
export interface ActivityConfig {
  recentCount?: number;
  heatmapWeeks?: number;
}
interface ActivityDay {
  date: string;
  count: number;
  level: number;
  future: boolean;
}
interface Activity {
  recent: (CatalogNote & { activityDate: string })[];
  days: ActivityDay[];
  counts: ActivityDay[];
  weeks: number;
  start: string | null;
  end: string | null;
}
const DAY = 86400000;
const iso = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10);
// One last-known update per public article, not a complete editing history.
export function articleActivity(
  pages: CatalogNote[],
  { recentCount = 1, heatmapWeeks = 26 }: ActivityConfig = {},
): Activity {
  if (
    !Number.isInteger(recentCount) ||
    recentCount < 0 ||
    !Number.isInteger(heatmapWeeks) ||
    heatmapWeeks < 1 ||
    heatmapWeeks > 53
  )
    throw new Error("Invalid home activity configuration");
  const articles = [
    ...new Map(
      pages
        .filter(
          (n) => n.kind === "article" && n.publish !== false && !n.unlisted,
        )
        .map((n) => [n.slug, n]),
    ).values(),
  ]
    .map((n) => {
      const day = n.updated || n.date;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day + "T00:00:00Z")) ||
        iso(Date.parse(day + "T00:00:00Z")) !== day
      )
        throw new Error(`Invalid article activity date: ${n.slug}`);
      return { ...n, activityDate: day };
    })
    .sort(
      (a, b) =>
        b.activityDate.localeCompare(a.activityDate) ||
        a.slug.localeCompare(b.slug, "en"),
    );
  if (!articles.length)
    return {
      recent: [],
      days: [],
      counts: [],
      weeks: heatmapWeeks,
      start: null,
      end: null,
    };
  const end = articles[0].activityDate;
  const last = Date.parse(end + "T00:00:00Z");
  const start =
    last - new Date(last).getUTCDay() * DAY - (heatmapWeeks - 1) * 7 * DAY;
  const counts = new Map<string, number>();
  for (const n of articles)
    counts.set(n.activityDate, (counts.get(n.activityDate) || 0) + 1);
  const days = Array.from({ length: heatmapWeeks * 7 }, (_, i) => {
    const day = iso(start + i * DAY),
      count = counts.get(day) || 0;
    return { date: day, count, level: Math.min(count, 4), future: day > end };
  });
  return {
    recent: articles.slice(0, recentCount),
    days,
    counts: days.filter((d) => d.count && !d.future),
    weeks: heatmapWeeks,
    start: iso(start),
    end,
  };
}
