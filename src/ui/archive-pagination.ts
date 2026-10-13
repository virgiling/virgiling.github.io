import {
  buildFolderTree,
  sortedFolders,
  stackNotes,
  type ArchiveConfig,
  type FolderNode,
} from "./archive";
import type { CatalogNote } from "./types";
import { folderFrameId } from "./shared";
import { url, siteConfig } from "../site.config";

export interface ArchiveSlice {
  root: FolderNode;
  rootIndex: number;
  part: number;
  parts: number;
}
export interface DirectoryLink {
  path: string;
  label: string;
  href: string;
  root: boolean;
  count: number;
}
export interface ArchivePagination {
  pages: ArchiveSlice[];
  directories: DirectoryLink[];
}
export const archiveRoute = (index: number) =>
  index === 0 ? "articles" : `articles/${index + 1}`;

export function buildArchivePagination(
  notes: CatalogNote[],
  config: ArchiveConfig & { pageSize?: number } = {},
): ArchivePagination {
  const size = config.pageSize ?? siteConfig.archive.pageSize;
  if (!Number.isInteger(size) || size < 1)
    throw new Error("Invalid archive page size");
  const roots = buildFolderTree(
    notes.filter(
      (n) => n.publish !== false && !n.unlisted && n.kind !== "landing",
    ),
    config.directories,
  );
  const order = config.rootOrder ?? [];
  roots.sort(
    (a, b) =>
      (order.includes(a.path) ? order.indexOf(a.path) : order.length) -
        (order.includes(b.path) ? order.indexOf(b.path) : order.length) ||
      a.path.localeCompare(b.path, "en"),
  );
  const pages: ArchiveSlice[] = [];
  const directories: DirectoryLink[] = [];
  function flatten(node: FolderNode): CatalogNote[] {
    return [
      ...stackNotes(node),
      ...sortedFolders(node.children.values()).flatMap(flatten),
    ];
  }
  function slice(node: FolderNode, ids: Set<string>): FolderNode {
    const children = [...node.children]
      .map(([key, child]) => [key, slice(child, ids)] as const)
      .filter(([, child]) => child.members.size);
    const own = stackNotes(node).filter((n) => ids.has(n.slug));
    return {
      ...node,
      notes: own,
      children: new Map(children),
      members: new Set([
        ...own.map((n) => n.slug),
        ...children.flatMap(([, c]) => [...c.members]),
      ]),
    };
  }
  roots.forEach((root, rootIndex) => {
    const cards = flatten(root);
    const parts = Math.max(1, Math.ceil(cards.length / size));
    const firstPage = pages.length;
    for (let part = 0; part < parts; part++) {
      const subset = slice(
        root,
        new Set(cards.slice(part * size, (part + 1) * size).map((n) => n.slug)),
      );
      pages.push({ root: subset, rootIndex, part, parts });
    }
    function mapDirectory(node: FolderNode, isRoot: boolean) {
      const first = cards.findIndex((n) => node.members.has(n.slug));
      const index =
        isRoot || first < 0 ? firstPage : firstPage + Math.floor(first / size);
      directories.push({
        path: node.path,
        label: node.label,
        href: url(archiveRoute(index)) + "#" + folderFrameId(node.path),
        root: isRoot,
        count: node.members.size,
      });
      sortedFolders(node.children.values()).forEach((n) =>
        mapDirectory(n, false),
      );
    }
    mapDirectory(root, true);
  });
  return { pages, directories };
}
