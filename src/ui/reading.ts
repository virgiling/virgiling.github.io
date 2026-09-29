import type { Note } from "../content/types";
import type { siteConfig } from "../site.config";

export function readingMinutes(
  note: Pick<Note, "readingText" | "plainText">,
  config: typeof siteConfig.reading,
) {
  const text = note.readingText || note.plainText;
  const cjk = (
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []
  ).length;
  const words = (
    text
      .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, " ")
      .match(/[\p{L}\p{N}]+/gu) || []
  ).length;
  return Math.max(
    1,
    Math.ceil(cjk / config.cjkPerMinute + words / config.wordsPerMinute),
  );
}

export function relations<T extends Pick<Note, "slug" | "links">>(
  note: T,
  pages: T[],
) {
  const incoming = pages.filter((page) => page.links.includes(note.slug));
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const connected = [
    ...new Set([...note.links, ...incoming.map((page) => page.slug)]),
  ]
    .map((id) => bySlug.get(id))
    .filter((page): page is T => page !== undefined);
  return { incoming, connected };
}

export const dateText = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
