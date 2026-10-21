// Canvas painting for the global graph view.
import { globalLabelOpacity } from "./display";
import { globalGraphStyle } from "./global-style";
import type { GraphData, GraphNode, Point, ViewTransform } from "./data";
interface PaintOptions {
  width: number;
  height: number;
  dpr?: number;
  transform: ViewTransform;
  current?: string;
  fontFamily?: string;
  nodesById?: Map<string, GraphNode>;
  highlight?: string;
}
const colors = {
  page: "#728d5c",
  current: "#3d5f30",
  tag: "#58764a",
  text: "#5d6f51",
  link: "#bccbb0",
  parent: "#92a681",
  membership: "#c0cbb6",
};
export function fitTransform(
  data: { width: number; height: number; left?: number; top?: number },
  width: number,
  height: number,
): ViewTransform {
  const k = Math.max(
    0.1,
    Math.min(5, 0.9 * Math.min(width / data.width, height / data.height)),
  );
  return {
    k,
    x: (width - data.width * k) / 2 - (data.left || 0) * k,
    y: (height - data.height * k) / 2 - (data.top || 0) * k,
  };
}
export function pickNode<N extends Point & { radius?: number }>(
  nodes: N[],
  point: Point,
  transform: ViewTransform,
): N | undefined {
  const x = (point.x - transform.x) / transform.k,
    y = (point.y - transform.y) / transform.k,
    r = Math.max(10, 9 / transform.k);
  for (let i = nodes.length - 1; i >= 0; i--)
    if (
      Math.hypot(nodes[i].x - x, nodes[i].y - y) <=
      Math.max(r, (nodes[i].radius || 6) + 3)
    )
      return nodes[i];
}
export function paintGraph(
  ctx: CanvasRenderingContext2D,
  data: Pick<GraphData, "nodes" | "edges">,
  {
    width,
    height,
    dpr = 1,
    transform,
    current,
    fontFamily = "serif",
    nodesById,
    highlight,
  }: PaintOptions,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
  const nodes = nodesById || new Map(data.nodes.map((n) => [n.id, n]));
  ctx.setLineDash([]);
  for (const e of data.edges) {
    const a = nodes.get(e.from)!,
      b = nodes.get(e.to)!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      distance = Math.hypot(dx, dy),
      start = a.radius || 6,
      end = b.radius || 6;
    // Stop at the visible circles, including hollow tags; dragged nodes can overlap.
    if (distance <= start + end) continue;
    ctx.beginPath();
    ctx.strokeStyle =
      e.type === "tag-parent"
        ? colors.parent
        : e.type === "tag-membership"
          ? colors.membership
          : colors.link;
    ctx.lineWidth = globalGraphStyle.linkThickness / transform.k;
    ctx.globalAlpha = 1;
    ctx.moveTo(a.x + (dx * start) / distance, a.y + (dy * start) / distance);
    ctx.lineTo(b.x - (dx * end) / distance, b.y - (dy * end) / distance);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.font = `14px ${fontFamily}`;
  ctx.textAlign = "center";
  for (const n of data.nodes) {
    const radius = n.radius || 6;
    if (n.type === "tag") {
      ctx.strokeStyle = colors.tag;
      ctx.lineWidth = 1.5;
      for (const r of [radius, radius * 0.5]) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = n.id === `page:${current}` ? colors.current : colors.page;
      ctx.fill();
    }
    if (n.id === highlight) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = colors.current;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const opacity =
      n.id === highlight || n.id === `page:${current}`
        ? 1
        : globalLabelOpacity(transform.k);
    if (opacity > 0) {
      const label = Array.from(n.label);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = colors.text;
      ctx.fillText(
        label.length > 24 ? label.slice(0, 23).join("") + "…" : n.label,
        n.x,
        n.y + radius + 14,
      );
      ctx.globalAlpha = 1;
    }
  }
}
