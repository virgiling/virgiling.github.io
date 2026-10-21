// On-demand Canvas view: simulation, paint scheduling and lifecycle only.
import { createGraphSimulation } from "../graph/force-simulator";
import { motionLoop } from "./motion";
import { globalGraphStyle } from "../graph/global-style";
import { validateGraph } from "../graph/data";
import { paintGraph } from "../graph/paint";
import { createGraphInput } from "./graph-input";
export {
  safeGraphURL,
  validateGraph,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type Point,
  type ViewTransform,
} from "../graph/data";
export { fitTransform, paintGraph, pickNode } from "../graph/paint";
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
    paintFrame: number | undefined,
    disposed = false,
    remaining = 0;
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
            transform: interaction.getTransform(),
            current,
            fontFamily,
            nodesById,
            highlight: interaction.highlight(),
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
  const interaction = createGraphInput({
    canvas,
    nodes: data.nodes,
    current,
    navigate,
    repaint,
    reheat,
    size: () => ({ width, height }),
  });
  for (const [label, text, action] of [
    ["缩小图谱", "−", () => interaction.zoomBy(0.8)],
    ["放大图谱", "+", () => interaction.zoomBy(1.25)],
    ["重置视图", "↺", () => interaction.reset()],
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
    interaction.reset();
  }
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
      interaction.destroy();
      canvas.width = canvas.height = 0;
      host.replaceChildren();
    },
  };
}
