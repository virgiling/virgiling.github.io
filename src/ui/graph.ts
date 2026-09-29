import { tagURL } from "./shared.ts";
import { globalForceLayout } from "../graph/force-simulator";
import type { Note } from "../content/types";

export type GraphPage = Pick<
  Note,
  "slug" | "title" | "url" | "links" | "tags"
> & { publish?: boolean; unlisted?: boolean; graphLabel?: string };
interface NodeBase {
  id: string;
  label: string;
  url: string;
}
interface PageNode extends NodeBase {
  type: "page";
  shortLabel: string;
  current: boolean;
}
interface TagNode extends NodeBase {
  type: "tag";
  path: string;
  parent?: string;
  current?: false;
}
export type GraphNode = PageNode | TagNode;
export interface GraphEdge {
  from: string;
  to: string;
  type: "page-link" | "tag-parent" | "tag-membership";
}
export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export interface GraphLayout {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
}

export function graphModel(
  current: GraphPage | null,
  neighbors: GraphPage[],
): GraphModel {
  const pages = [
    ...new Map(
      [current, ...neighbors]
        .filter((note): note is GraphPage =>
          Boolean(
            note &&
            note.publish !== false &&
            (!note.unlisted || (current && note.slug === current.slug)),
          ),
        )
        .map((note) => [note.slug, note]),
    ).values(),
  ];
  const nodes: PageNode[] = pages.map((note) => ({
    id: `page:${note.slug}`,
    type: "page",
    label: note.title,
    shortLabel: note.graphLabel || note.title,
    url: note.url,
    current: note.slug === current?.slug,
  }));
  const tags = new Map<string, TagNode>();
  const edges = new Map<string, GraphEdge>();
  const pageIds = new Set(pages.map((note) => note.slug));
  const edge = (from: string, to: string, type: GraphEdge["type"]) =>
    edges.set(`${type}:${from}>${to}`, { from, to, type });
  for (const page of pages) {
    for (const linked of page.links || [])
      if (linked !== page.slug && pageIds.has(linked))
        edge(`page:${page.slug}`, `page:${linked}`, "page-link");
    for (const tag of page.tags || []) {
      const parts = tag.split("/").filter(Boolean);
      let parent: string | undefined;
      for (let i = 1; i <= parts.length; i++) {
        const path = parts.slice(0, i).join("/"),
          id = `tag:${path}`;
        tags.set(id, {
          id,
          type: "tag",
          label: parts[i - 1],
          path,
          url: tagURL(path),
          parent,
        });
        if (parent) edge(parent, id, "tag-parent");
        parent = id;
      }
      if (parent) edge(`page:${page.slug}`, parent, "tag-membership");
    }
  }
  return { nodes: [...nodes, ...tags.values()], edges: [...edges.values()] };
}
// Strict radius-one induced subgraph; neighbors' tags and tag ancestors are not appended.
export function localGraphModel(
  current: GraphPage,
  neighbors: GraphPage[],
): GraphModel {
  const model = graphModel(current, neighbors),
    center = `page:${current.slug}`,
    ids = new Set([center]);
  for (const edge of model.edges) {
    if (edge.from === center) ids.add(edge.to);
    if (edge.to === center) ids.add(edge.from);
  }
  const nodes = model.nodes
    .filter((node) => ids.has(node.id))
    .sort(
      (a, b) =>
        Number(b.current === true) - Number(a.current === true) ||
        a.id.localeCompare(b.id, "en"),
    );
  const edges = model.edges
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
    .sort((a, b) =>
      `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`, "en"),
    );
  return { nodes, edges };
}
export function graphNodeLabel(node: GraphNode) {
  const text = node.type === "tag" ? "#" + node.label : node.shortLabel;
  const characters = Array.from(text);
  return characters.length > 18 ? characters.slice(0, 17).join("") + "…" : text;
}
export function globalGraphData(pages: GraphPage[]) {
  const model = graphModel(null, pages);
  const layout: GraphLayout = globalForceLayout(model);
  return {
    version: 1,
    layout: "force",
    width: layout.width,
    height: layout.height,
    nodes: model.nodes.map(({ current, ...node }) => ({
      ...node,
      ...layout.positions.get(node.id)!,
    })),
    edges: model.edges,
  };
}
