import { tagURL } from "./shared";
import type { ArticleSummary } from "./types";
export interface TagGroup {
  tag: string;
  url: string;
  notes: ArticleSummary[];
}
export function buildTags(notes: ArticleSummary[]): TagGroup[] {
  const groups = new Map<string, Map<string, ArticleSummary>>();
  for (const note of notes) {
    for (const tag of note.tags || []) {
      const parts = tag.split("/").filter(Boolean);
      for (let i = 1; i <= parts.length; i++) {
        const path = parts.slice(0, i).join("/");
        if (!groups.has(path)) groups.set(path, new Map());
        groups.get(path)!.set(note.slug, note);
      }
    }
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
    .map(([tag, items]) => ({
      tag,
      url: tagURL(tag),
      notes: [...items.values()].sort(
        (a, b) =>
          (b.updated || b.date || "").localeCompare(
            a.updated || a.date || "",
          ) || a.slug.localeCompare(b.slug, "en"),
      ),
    }));
}
