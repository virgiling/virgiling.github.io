import { posix } from "node:path";
import type { CatalogNote } from "./types";
import type { DirectoryMeta } from "../content/types";
import type { DirectoryLink } from "./archive-pagination";
import { url } from "../site.config";

export function seriesNavigation(
  note: CatalogNote,
  pages: CatalogNote[],
  directories: DirectoryMeta[],
  archive: DirectoryLink[],
) {
  if (note.kind === "landing" || note.unlisted) return undefined;
  const parent = posix.dirname(note.source);
  const listed = pages.filter(
    (n) => n.publish !== false && !n.unlisted && n.kind !== "landing",
  );
  const siblings = listed.filter((n) => posix.dirname(n.source) === parent);
  const isIndex = (n: CatalogNote) =>
    n.isDirectoryIndex || posix.basename(n.source) === "index.md";
  const index = siblings.find(isIndex);
  const collator = new Intl.Collator("en", { numeric: true });
  const ordered = siblings
    .filter((n) => !isIndex(n))
    .sort(
      (a, b) =>
        (a.date || "9999").localeCompare(b.date || "9999") ||
        collator.compare(a.slug, b.slug) ||
        a.source.localeCompare(b.source, "en"),
    );
  const position = ordered.findIndex((n) => n.slug === note.slug);
  const root = note.source.includes("/") ? note.source.split("/")[0] : "";
  const metadata = directories.find((d) => d.path === parent);
  const moc = [
    metadata?.moc,
    directories.find((d) => d.path === root)?.moc,
  ].find((m) => m && listed.some((n) => n.source === m.source));
  const folder =
    archive.find((d) => d.path === (parent === "." ? "" : parent)) ??
    archive.find((d) => d.path === root);
  return {
    previous: position > 0 ? ordered[position - 1] : undefined,
    next: position >= 0 ? ordered[position + 1] : undefined,
    index: index?.slug !== note.slug ? index : undefined,
    back: {
      label: metadata?.title || folder?.label || "文章",
      url:
        moc?.url && moc.url !== note.url
          ? moc.url
          : folder?.href || url("articles"),
    },
  };
}
