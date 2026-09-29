import { url } from "../site.config.ts";
import { esc, folderFrameId } from "./shared.mjs";
import { classifyContentPath } from "../content-policy.mjs";
// Reading documents only. Folder display names come from publication-filtered indexes.
export function Breadcrumbs(note, pages, directories = [], prefix = "") {
  if (!["article", "directory"].includes(note.kind) || !note.source) return "";
  if (classifyContentPath(note.source) !== "markdown")
    throw new Error("Breadcrumb source must be a public Markdown path");
  const parts = note.source.replaceAll("\\", "/").split("/").slice(0, -1),
    metadata = new Map(directories.map((d) => [d.path, d]));
  const items = [{ label: "主页", url: url("") }];
  for (let i = 0; i < parts.length; i++) {
    const path = parts.slice(0, i + 1).join("/");
    const directory = metadata.get(path),
      index = pages.find(
        (n) =>
          n.source === path + "/index.md" && n.publish !== false && !n.unlisted,
      );
    const moc =
      directory?.moc &&
      pages.find(
        (n) =>
          n.source === directory.moc.source &&
          n.publish === true &&
          !n.unlisted,
      );
    items.push({
      label: directory?.title || index?.title || parts[i],
      url: moc
        ? prefix + moc.url
        : index
          ? prefix + index.url
          : url("articles") + "#" + folderFrameId(path),
    });
  }
  return `<nav class="breadcrumb" aria-label="面包屑"><ol>${items.map((item) => `<li>${item.url === prefix + note.url ? `<span aria-current="page">${esc(item.label)}</span>` : `<a href="${esc(item.url)}">${esc(item.label)}</a>`}</li>`).join("")}</ol></nav>`;
}
