import { esc, tagURL } from "./shared.mjs";
import { localGraphLayout } from "./local-graph-layout.mjs";
import { globalForceLayout } from "../graph/force-simulator.mjs";
export function graphModel(current, neighbors) {
  const pages = [
    ...new Map(
      [current, ...neighbors]
        .filter(
          (n) =>
            n &&
            n.publish !== false &&
            (!n.unlisted || (current && n.slug === current.slug)),
        )
        .map((n) => [n.slug, n]),
    ).values(),
  ];
  const nodes = pages.map((n) => ({
    id: `page:${n.slug}`,
    type: "page",
    label: n.title,
    shortLabel: n.graphLabel || n.title,
    url: n.url,
    current: n.slug === current?.slug,
  }));
  const tags = new Map(),
    edges = new Map(),
    pageIds = new Set(pages.map((n) => n.slug));
  const edge = (from, to, type) =>
    edges.set(`${type}:${from}>${to}`, { from, to, type });
  for (const page of pages) {
    for (const linked of page.links || [])
      if (linked !== page.slug && pageIds.has(linked))
        edge(`page:${page.slug}`, `page:${linked}`, "page-link");
    for (const tag of page.tags || []) {
      const parts = tag.split("/").filter(Boolean);
      let parent;
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
// Strict radius-one induced subgraph, like Quartz's local depth=1: outgoing
// pages, backlinks and the current note's explicit tags. Never append neighbours'
// tags or a tag's ancestors just because they exist in the global graph.
export function localGraphModel(current, neighbors) {
  const model = graphModel(current, neighbors),
    center = `page:${current.slug}`,
    ids = new Set([center]);
  for (const edge of model.edges) {
    if (edge.from === center) ids.add(edge.to);
    if (edge.to === center) ids.add(edge.from);
  }
  const nodes = model.nodes
    .filter((n) => ids.has(n.id))
    .sort(
      (a, b) =>
        Number(b.current === true) - Number(a.current === true) ||
        a.id.localeCompare(b.id, "en"),
    );
  const edges = model.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .sort((a, b) =>
      `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`, "en"),
    );
  return { nodes, edges };
}
// Same adapted force core supplies the initial layout and live drag relaxation.
export const graphLayout = globalForceLayout;
function GraphSVG(model) {
  const layout = localGraphLayout(model);
  const edges = model.edges
    .map((edge) => {
      const a = layout.positions.get(edge.from),
        b = layout.positions.get(edge.to);
      return `<line data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" class="${edge.type}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    })
    .join("");
  const nodes = model.nodes
    .map((node) => {
      const { x, y } = layout.positions.get(node.id),
        tag = node.type === "tag",
        radius = 5.5;
      const shape = tag
        ? `<circle class="tag-ring" cx="${x}" cy="${y}" r="${radius}"/><circle class="tag-ring" cx="${x}" cy="${y}" r="${radius * 0.5}"/>`
        : `<circle class="page-node${node.current ? " current-node" : ""}" cx="${x}" cy="${y}" r="${node.current ? 7 : radius}"/>`;
      const text = tag ? "#" + node.label : node.shortLabel,
        characters = Array.from(text),
        label =
          characters.length > 18
            ? characters.slice(0, 17).join("") + "…"
            : text;
      return `<a class="graph-${node.type}" data-node-id="${esc(node.id)}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" href="${esc(node.url)}" aria-label="${tag ? "标签：" : ""}${esc(tag ? node.path : node.label)}"${!tag && !node.current ? ` data-preview="${esc(node.id.slice(5))}"` : ""}${node.current ? ' aria-current="page"' : ""}><title>${esc(tag ? node.path : node.label)}</title><circle class="graph-hit" cx="${x}" cy="${y}" r="12"/>${shape}<text class="graph-node-label" x="${x}" y="${y + 19}" text-anchor="middle">${esc(label)}</text></a>`;
    })
    .join("");
  return `<svg data-local-graph data-force-scale="${layout.scale}" viewBox="0 0 ${layout.width} ${layout.height}" role="group" tabindex="0" aria-label="当前笔记及其一跳邻居；支持拖动节点和缩放"><g data-graph-transform>${edges}${nodes}</g></svg>`;
}
const Legend = () =>
  '<div class="graph-legend"><span><i class="legend-page" aria-hidden="true"></i>页面</span><span><i class="legend-tag" aria-hidden="true"></i>标签</span></div>';
export function LocalGraph(n, neighbors) {
  const model = localGraphModel(n, neighbors),
    empty = model.nodes.filter((node) => node.type === "page").length < 2;
  return `<section class="side-section graph-section"><h2 class="side-title" id="graph-heading">关系图谱</h2><div class="graph graph-local">${GraphSVG(model)}<button class="graph-expand" id="open-graph" aria-label="打开全局关系图谱" aria-haspopup="dialog" aria-controls="graph-dialog" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/></svg></button>${empty ? '<p class="graph-empty">这篇笔记暂无关联笔记</p>' : ""}</div></section>`;
}
export function globalGraphData(pages) {
  const model = graphModel(null, pages),
    layout = graphLayout(model, true);
  return {
    version: 1,
    layout: "force",
    width: layout.width,
    height: layout.height,
    nodes: model.nodes.map(({ current, ...node }) => ({
      ...node,
      ...layout.positions.get(node.id),
    })),
    edges: model.edges,
  };
}
export function GraphDialog(n, p = "") {
  return `<dialog id="graph-dialog" class="graph-dialog" data-current="${esc(n.slug)}" data-root="${esc(p)}" aria-labelledby="graph-dialog-title"><header class="graph-dialog-header"><h2 id="graph-dialog-title">全局关系图谱</h2><button class="dialog-close" id="close-graph" aria-label="关闭全局关系图谱" autofocus>关闭</button></header><p id="graph-status" role="status" hidden></p><button id="retry-graph" hidden>重试</button><div id="graph-viewport" class="graph graph-expanded" aria-label="全局关系图谱"></div>${Legend()}</dialog>`;
}
