// On-demand Canvas view + the adapted starlight-site-graph force core.
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import { drag, dragEnable, type D3DragEvent } from "d3-drag";
import {
  createGraphSimulation,
  type SimulatedNode,
} from "../graph/force-simulator";
import { motionLoop, reduced } from "./motion";
import { globalLabelOpacity } from "../graph/display";
import { globalGraphStyle } from "../graph/global-style";
export interface Point {
  x: number;
  y: number;
}
export interface ViewTransform extends Point {
  k: number;
}
export interface GraphNode extends Point {
  id: string;
  type: "page" | "tag";
  label: string;
  url: string;
  path?: string;
  radius?: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  type: "page-link" | "tag-parent" | "tag-membership";
}
export interface GraphData {
  version: 1;
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
type LiveNode = SimulatedNode<GraphNode>;
type CanvasDragEvent = D3DragEvent<HTMLCanvasElement, unknown, LiveNode>;
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
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";
const colors = {
  page: "#728d5c",
  current: "#3d5f30",
  tag: "#58764a",
  text: "#5d6f51",
  link: "#bccbb0",
  parent: "#92a681",
  membership: "#c0cbb6",
};
export function safeGraphURL(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const path = decodeURIComponent(value);
    return (
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !/[\\\\?#:\u0000-\u0020\u007f]/.test(path) &&
      !path.split("/").some((p) => p === "." || p === "..")
    );
  } catch {
    return false;
  }
}
export function validateGraph(data: unknown): GraphData {
  if (
    !record(data) ||
    data.version !== 1 ||
    typeof data.width !== "number" ||
    !Number.isFinite(data.width) ||
    data.width <= 0 ||
    typeof data.height !== "number" ||
    !Number.isFinite(data.height) ||
    data.height <= 0 ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges)
  )
    throw new Error("Invalid graph data");
  const ids = new Set<string>();
  for (const n of data.nodes as unknown[]) {
    if (
      !record(n) ||
      typeof n.id !== "string" ||
      ids.has(n.id) ||
      !(n.type === "page" || n.type === "tag") ||
      typeof n.label !== "string" ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      !safeGraphURL(n.url)
    )
      throw new Error("Invalid graph node");
    ids.add(n.id);
  }
  for (const e of data.edges as unknown[])
    if (
      !record(e) ||
      typeof e.from !== "string" ||
      typeof e.to !== "string" ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      !(
        e.type === "page-link" ||
        e.type === "tag-parent" ||
        e.type === "tag-membership"
      )
    )
      throw new Error("Invalid graph edge");
  return data as unknown as GraphData;
}
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
export function mountGraph(
  host: HTMLElement,
  input: unknown,
  {
    current = "",
    navigate = (url) => location.assign(url),
  }: { current?: string; navigate?: (url: string) => void } = {},
) {
  const raw = validateGraph(input);
  const doc = host.ownerDocument || document;
  const canvas = doc.createElement("canvas"),
    controls = doc.createElement("div");
  controls.className = "graph-controls";
  canvas.setAttribute("role", "application");
  canvas.tabIndex = 0;
  host.replaceChildren(controls, canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    host.replaceChildren();
    throw new Error("Canvas 2D is unavailable");
  }
  const ctx = context;
  const simulation = createGraphSimulation(raw, {
    x: raw.width / 2,
    y: raw.height / 2,
  });
  const data = { ...raw, nodes: simulation.nodes() },
    nodesById = new Map(data.nodes.map((n) => [n.id, n]));
  let width = 1,
    height = 1,
    dpr = 1,
    transform = zoomIdentity,
    paintFrame: number | undefined,
    disposed = false,
    draggingView: Window | null | undefined,
    dragged: LiveNode | undefined,
    hovered: string | undefined,
    remaining = 0,
    focused = false;
  let selected =
    data.nodes.find((n) => n.id === `page:${current}`) || data.nodes[0];
  const fontFamily = getComputedStyle(host).fontFamily;
  function repaint() {
    if (!disposed && paintFrame === undefined)
      paintFrame = requestAnimationFrame(() => {
        paintFrame = undefined;
        if (!disposed)
          paintGraph(ctx, data, {
            width,
            height,
            dpr,
            transform,
            current,
            fontFamily,
            nodesById,
            highlight: hovered || (focused ? selected?.id : undefined),
          });
      });
  }
  const loop = motionLoop(
    () => {
      simulation.tick();
      repaint();
      return --remaining > 0 && simulation.alpha() >= simulation.alphaMin();
    },
    () => {
      simulation.tick(globalGraphStyle.force.ticks);
      repaint();
    },
    doc,
  );
  function reheat(alpha = 0.3) {
    simulation.alpha(Math.max(simulation.alpha(), alpha));
    remaining = globalGraphStyle.force.ticks;
    loop.start();
  }
  function at(event: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect(),
      point = "touches" in event ? event.touches[0] : event;
    return pickNode(
      data.nodes,
      {
        x: ((point.clientX - rect.left) * width) / rect.width,
        y: ((point.clientY - rect.top) * height) / rect.height,
      },
      transform,
    );
  }
  const behavior = zoom<HTMLCanvasElement, unknown>()
    .duration(0)
    .extent(() => [
      [0, 0],
      [width, height],
    ])
    .scaleExtent([0.1, 5])
    .clickDistance(3)
    .filter((event: MouseEvent | TouchEvent) => {
      if (
        event.type === "mousedown" ||
        (event.type === "touchstart" &&
          "touches" in event &&
          event.touches.length === 1)
      ) {
        if (at(event)) return false;
      }
      return (
        (!event.ctrlKey || event.type === "wheel") &&
        !("button" in event && event.button)
      );
    })
    .on("start.notes", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      if (event.sourceEvent?.type === "mousedown")
        draggingView = event.sourceEvent.view;
      if (event.sourceEvent?.touches?.length > 1 && dragged) {
        dragged.fx = dragged.fy = null;
        dragged = undefined;
        reheat();
      }
    })
    .on("end.notes", () => {
      draggingView = undefined;
    })
    .on("zoom.notes", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      transform = event.transform;
      repaint();
    });
  const selection = select(canvas).call(behavior);
  const dragging = drag<HTMLCanvasElement, unknown, LiveNode | undefined>()
    .container(canvas)
    .clickDistance(3)
    .subject((event) =>
      pickNode(data.nodes, { x: event.x, y: event.y }, transform),
    )
    .on("start.notes", (event: CanvasDragEvent) => {
      dragged = event.subject;
      draggingView = event.sourceEvent.view;
      dragged.fx = dragged.x;
      dragged.fy = dragged.y;
      if (!reduced.matches) reheat();
    })
    .on("drag.notes", (event: CanvasDragEvent) => {
      const n = event.subject;
      if (n !== dragged) return;
      n.fx = n.fx! + event.dx / transform.k;
      n.fy = n.fy! + event.dy / transform.k;
      n.x = n.fx;
      n.y = n.fy;
      repaint();
      if (!reduced.matches) reheat();
    })
    .on("end.notes", (event: CanvasDragEvent) => {
      event.subject.fx = event.subject.fy = null;
      dragged = draggingView = undefined;
      reheat();
    });
  selection.call(dragging);
  function reset() {
    const xs = data.nodes.map((n) => n.x),
      ys = data.nodes.map((n) => n.y),
      left = Math.min(0, ...xs) - 40,
      top = Math.min(0, ...ys) - 40;
    const t = fitTransform(
      {
        left,
        top,
        width: Math.max(100, ...xs) - left + 40,
        height: Math.max(100, ...ys) - top + 40,
      },
      width,
      height,
    );
    selection.call(
      behavior.transform,
      zoomIdentity.translate(t.x, t.y).scale(t.k),
    );
  }
  for (const [label, text, action] of [
    ["缩小图谱", "−", () => selection.call(behavior.scaleBy, 0.8)],
    ["放大图谱", "+", () => selection.call(behavior.scaleBy, 1.25)],
    ["重置视图", "↺", reset],
  ] as const) {
    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.textContent = text;
    button.addEventListener("click", action);
    controls.append(button);
  }
  function resize() {
    if (disposed) return;
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight),
      ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    if (w === width && h === height && ratio === dpr) return;
    width = w;
    height = h;
    dpr = ratio;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    reset();
  }
  function label() {
    canvas.setAttribute(
      "aria-label",
      `全局关系图谱。${selected ? "当前选择：" + selected.label + "。" : ""}方向键选择节点，Enter 打开，+/- 缩放，Home 复位。`,
    );
  }
  function keydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter" && selected) {
      event.preventDefault();
      navigate(selected.url);
      return;
    }
    if (["+", "=", "-", "Home", "0"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home" || event.key === "0") reset();
      else selection.call(behavior.scaleBy, event.key === "-" ? 0.8 : 1.25);
      return;
    }
    const direction = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    }[event.key];
    if (!direction || !selected) return;
    event.preventDefault();
    const candidates = data.nodes
      .filter((n) => n !== selected)
      .map((n) => {
        const dx = n.x - selected.x,
          dy = n.y - selected.y,
          forward = dx * direction[0] + dy * direction[1];
        return {
          n,
          forward,
          score:
            Math.hypot(dx, dy) +
            Math.abs(dx * direction[1] - dy * direction[0]) * 2,
        };
      })
      .filter((n) => n.forward > 0)
      .sort((a, b) => a.score - b.score);
    if (candidates[0]) selected = candidates[0].n;
    label();
    const x = selected.x * transform.k + transform.x,
      y = selected.y * transform.k + transform.y;
    if (x < 20 || x > width - 20 || y < 20 || y > height - 20)
      selection.call(
        behavior.transform,
        zoomIdentity
          .translate(
            width / 2 - selected.x * transform.k,
            height / 2 - selected.y * transform.k,
          )
          .scale(transform.k),
      );
    repaint();
  }
  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const n = at(event);
    if (n) navigate(n.url);
  };
  const hover = (event: PointerEvent) => {
    const n = at(event);
    if (hovered !== n?.id) {
      hovered = n?.id;
      repaint();
    }
    canvas.style.cursor = dragged ? "grabbing" : n ? "grab" : "move";
    canvas.title = n
      ? n.type === "tag"
        ? "#" + (n.path || n.label)
        : n.label
      : "";
  };
  const focus = () => {
      focused = true;
      repaint();
    },
    blur = () => {
      focused = false;
      repaint();
    };
  const leave = () => {
    hovered = undefined;
    repaint();
  };
  const listeners = {
    click,
    pointermove: hover,
    pointerleave: leave,
    keydown,
    focus,
    blur,
  };
  for (const [type, handler] of Object.entries(listeners))
    canvas.addEventListener(type, handler as EventListener);
  label();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  simulation.alpha(0.18);
  reheat(0.18);
  doc.fonts?.ready.then(() => {
    if (!disposed) repaint();
  });
  // Canvas-only labels may contain glyphs absent from the surrounding DOM.
  // Request their matching shards only when the global view is mounted.
  doc.fonts
    ?.load?.(`14px ${fontFamily}`, data.nodes.map((n) => n.label).join(""))
    .then(() => repaint())
    .catch(() => {});
  return {
    destroy() {
      disposed = true;
      loop.destroy();
      simulation.stop().force("link", null).nodes([]);
      observer.disconnect();
      if (paintFrame !== undefined) cancelAnimationFrame(paintFrame);
      selection.on(".zoom", null).on(".drag", null);
      if (draggingView) {
        select(draggingView).on(
          "mousemove.zoom mouseup.zoom mousemove.drag mouseup.drag",
          null,
        );
        dragEnable(draggingView, false);
      }
      for (const [type, handler] of Object.entries(listeners))
        canvas.removeEventListener(type, handler as EventListener);
      canvas.width = canvas.height = 0;
      host.replaceChildren();
    },
  };
}
