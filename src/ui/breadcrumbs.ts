import { url } from "../site.config";
import { folderFrameId } from "./shared";
import { classifyContentPath } from "../content-policy";
import type { Note, DirectoryMeta } from "../content/types";
import type { CatalogNote } from "./types";
export function breadcrumbItems(
  note: Pick<Note, "kind" | "source">,
  pages: CatalogNote[],
  directories: DirectoryMeta[] = [],
) {
  if (!["article", "directory"].includes(note.kind) || !note.source) return [];
  if (classifyContentPath(note.source) !== "markdown")
    throw new Error("Breadcrumb source must be a public Markdown path");
  const parts = note.source.replaceAll("\\", "/").split("/").slice(0, -1);
  const metadata = new Map(directories.map((d) => [d.path, d]));
  const items = [{ label: "主页", url: url("") }];
  for (let i = 0; i < parts.length; i++) {
    const path = parts.slice(0, i + 1).join("/");
    const directory = metadata.get(path);
    const index = pages.find(
      (n) =>
        n.source === path + "/index.md" && n.publish !== false && !n.unlisted,
    );
    const moc =
      directory?.moc &&
      pages.find(
        (n) =>
          n.source === directory.moc!.source &&
          n.publish === true &&
          !n.unlisted,
      );
    items.push({
      label: directory?.title || index?.title || parts[i],
      url: moc
        ? moc.url
        : index
          ? index.url
          : url("articles") + "#" + folderFrameId(path),
    });
  }
  return items;
}
