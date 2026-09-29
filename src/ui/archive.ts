import { classifyContentPath } from "../content-policy";
import type { DirectoryMeta } from "../content/types";
import type { CatalogNote } from "./types";

export interface FolderNode {
  label: string;
  path: string;
  children: Map<string, FolderNode>;
  notes: CatalogNote[];
  members: Set<string>;
  moc?: CatalogNote;
}
export interface ArchiveConfig {
  directories?: DirectoryMeta[];
  rootOrder?: string[];
}
function folder(path: string, label: string): FolderNode {
  return { label, path, children: new Map(), notes: [], members: new Set() };
}
// One canonical source path per note. Tags never determine archive membership.
export function buildFolderTree(
  notes: CatalogNote[],
  directories: DirectoryMeta[] = [],
): FolderNode[] {
  const roots = new Map<string, FolderNode>();
  const seen = new Map<string, string>();
  const titles = new Map(directories.map((d) => [d.path, d.title]));
  for (const note of notes) {
    if (classifyContentPath(note.source) !== "markdown")
      throw new Error(
        `Archive requires a public Markdown source: ${note.source}`,
      );
    if (seen.has(note.slug)) {
      if (seen.get(note.slug) !== note.source)
        throw new Error(`Conflicting source paths for ${note.slug}`);
      continue;
    }
    seen.set(note.slug, note.source);
    const folders = note.source.replaceAll("\\", "/").split("/").slice(0, -1);
    const parts = folders.length ? folders : [""];
    let siblings = roots,
      path = "";
    for (let i = 0; i < parts.length; i++) {
      path += (path ? "/" : "") + parts[i];
      if (!siblings.has(parts[i]))
        siblings.set(
          parts[i],
          folder(path, titles.get(path) || parts[i] || "根目录"),
        );
      const node = siblings.get(parts[i])!;
      node.members.add(note.slug);
      if (i === parts.length - 1) node.notes.push(note);
      siblings = node.children;
    }
  }
  const bySource = new Map(notes.map((n) => [n.source, n]));
  const mapped = new Set<string>();
  for (const directory of directories) {
    if (!directory.path || directory.path.includes("/") || !directory.moc)
      continue;
    const moc = bySource.get(directory.moc.source);
    if (!moc || moc.publish !== true || moc.unlisted || mapped.has(moc.source))
      continue;
    if (!roots.has(directory.path))
      roots.set(directory.path, folder(directory.path, directory.title));
    roots.get(directory.path)!.moc = moc;
    mapped.add(moc.source);
  }
  function prune(nodes: Map<string, FolderNode>) {
    for (const [key, node] of nodes) {
      node.notes = node.notes.filter((n) => !mapped.has(n.source));
      prune(node.children);
      node.members = new Set([
        ...node.notes.map((n) => n.slug),
        ...[...node.children.values()].flatMap((n) => [...n.members]),
        ...(node.moc ? [node.moc.slug] : []),
      ]);
      if (!node.members.size) nodes.delete(key);
    }
  }
  prune(roots);
  return [...roots.values()];
}
export const sortedFolders = (nodes: Iterable<FolderNode>) =>
  [...nodes].sort((a, b) => a.path.localeCompare(b.path, "en"));
export function stackNotes(node: FolderNode) {
  const isIndex = (n: CatalogNote) =>
    n.isDirectoryIndex || /(?:^|\/)index\.md$/.test(n.source);
  return [...node.notes].sort(
    (a, b) =>
      Number(Boolean(isIndex(b))) - Number(Boolean(isIndex(a))) ||
      String(b.date || "").localeCompare(a.date || "") ||
      a.slug.localeCompare(b.slug, "en"),
  );
}
