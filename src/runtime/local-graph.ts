// Native SVG links first. Node dragging enhances the existing one-hop model;
// the plugin-derived force engine is lazy, and the background never pans.
import { labelOpacity } from "../graph/display";
import type { LocalForceController, LocalForceNode } from "./local-graph-force";
interface Point {
  x: number;
  y: number;
}
interface View extends Point {
  k: number;
}
interface GraphNode extends LocalForceNode {
  initial: Point;
  element: SVGAElement;
}
interface DragState {
  id: number;
  node: GraphNode;
  start: Point;
  origin: Point;
  dragging: boolean;
}
interface PinchState {
  view: View;
  center: Point;
  distance: number;
}
type ForceModule = Pick<
  typeof import("./local-graph-force"),
  "mountLocalForce"
>;
export function zoomAt(view: View, point: Point, factor: number): View {
  const k = Math.min(6, Math.max(0.35, view.k * factor)),
    ratio = k / view.k;
  return {
    k,
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
  };
}
export function mountLocalGraph(
  svg: SVGSVGElement,
  {
    load = () => import("./local-graph-force"),
  }: { load?: () => Promise<ForceModule> } = {},
) {
  const group = svg.querySelector<SVGGElement>("[data-graph-transform]");
  if (!group) return { destroy() {} };
  const box = svg.viewBox.baseVal,
    win = svg.ownerDocument.defaultView!,
    pointers = new Map<number, Point>(),
    listeners: (() => void)[] = [];
  const nodes: GraphNode[] = [
    ...group.querySelectorAll<SVGAElement>("a[data-node-id]"),
  ].map((element) => {
    const hit = element.querySelector<SVGCircleElement>(".graph-hit")!,
      x = Number(hit.getAttribute("cx")),
      y = Number(hit.getAttribute("cy"));
    return {
      id: element.dataset.nodeId!,
      current: element.hasAttribute("aria-current"),
      x,
      y,
      initial: { x, y },
      element,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [
    ...group.querySelectorAll<SVGLineElement>("line[data-from][data-to]"),
  ].map((element) => ({
    from: element.dataset.from!,
    to: element.dataset.to!,
    element,
  }));
  let view: View = { k: 1, x: 0, y: 0 },
    active: DragState | undefined,
    pinch: PinchState | undefined,
    suppressClick = false,
    frame: number | undefined,
    disposed = false,
    engine: LocalForceController | undefined,
    prepared: Promise<ForceModule> | undefined,
    boot: Promise<void> | undefined,
    revision = 0,
    lastMoved: string | undefined;
  const on = <K extends keyof GlobalEventHandlersEventMap>(
    target: EventTarget,
    event: K,
    fn: (event: GlobalEventHandlersEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ) => {
    const listener = fn as EventListener;
    target.addEventListener(event, listener, options);
    listeners.push(() => target.removeEventListener(event, listener, options));
  };
  const draw = () => {
    frame = undefined;
    if (disposed) return;
    group.setAttribute(
      "transform",
      `translate(${view.x} ${view.y}) scale(${view.k})`,
    );
    svg.dataset.zoom = String(view.k);
    svg.style.setProperty(
      "--graph-label-opacity",
      String(labelOpacity(view.k)),
    );
    for (const n of nodes)
      n.element.setAttribute(
        "transform",
        `translate(${n.x - n.initial.x} ${n.y - n.initial.y})`,
      );
    for (const e of edges) {
      const a = byId.get(e.from)!,
        b = byId.get(e.to)!;
      e.element.setAttribute("x1", String(a.x));
      e.element.setAttribute("y1", String(a.y));
      e.element.setAttribute("x2", String(b.x));
      e.element.setAttribute("y2", String(b.y));
    }
  };
  const render = () => {
    if (!disposed && frame === undefined) frame = requestAnimationFrame(draw);
  };
  const center = () => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
  const clamp = (p: Point): Point => ({
    x: Math.max(12, Math.min(box.width - 12, p.x)),
    y: Math.max(12, Math.min(box.height - 24, p.y)),
  });
  const targetNode = (target: EventTarget | null) => {
    const a = (target as Element | null)?.closest?.<SVGAElement>(
      "a[data-node-id]",
    );
    return a && group.contains(a) ? byId.get(a.dataset.nodeId!) : undefined;
  };
  function point(event: Pick<MouseEvent, "clientX" | "clientY">): Point {
    const rect = svg.getBoundingClientRect(),
      scale = Math.min(rect.width / box.width, rect.height / box.height);
    return {
      x:
        (event.clientX - rect.left - (rect.width - box.width * scale) / 2) /
          scale +
        box.x,
      y:
        (event.clientY - rect.top - (rect.height - box.height * scale) / 2) /
          scale +
        box.y,
    };
  }
  function prepare() {
    return (prepared ??= Promise.resolve()
      .then(load)
      .catch((error) => {
        prepared = undefined;
        throw error;
      }));
  }
  function hydrate() {
    if (engine || boot || disposed) return;
    const ticket = revision;
    const pending: Promise<void> = prepare()
      .then(({ mountLocalForce }) => {
        if (disposed || ticket !== revision || engine) return;
        engine = mountLocalForce(
          {
            nodes: nodes.map(({ id, current, x, y }) => ({
              id,
              current,
              x,
              y,
            })),
            edges: edges.map(({ from, to }) => ({ from, to })),
          },
          {
            width: box.width,
            height: box.height,
            scale: Number(svg.dataset.forceScale) || 1,
            doc: svg.ownerDocument,
            onUpdate: (updated) => {
              if (disposed || ticket !== revision) return;
              for (const n of updated) {
                const target = byId.get(n.id)!;
                target.x = n.x;
                target.y = n.y;
              }
              render();
            },
          },
        );
        if (lastMoved) {
          const n = byId.get(lastMoved)!;
          engine.move(n.id, n.x, n.y);
          if (active?.node !== n || !active.dragging) engine.release(n.id);
        }
      })
      .catch(() => {
        /* Direct dragging, links and reset remain available; retry on next movement. */
      })
      .finally(() => {
        if (boot === pending) boot = undefined;
      });
    boot = pending;
  }
  function move(n: GraphNode, p: Point) {
    const position = clamp(p);
    n.x = position.x;
    n.y = position.y;
    lastMoved = n.id;
    engine?.move(n.id, n.x, n.y);
    render();
    hydrate();
  }
  function endNode() {
    if (active?.dragging) {
      engine?.release(active.node.id);
      active.node.element.classList.remove("is-dragging");
    }
    active = undefined;
    svg.classList.remove("is-node-dragging");
  }
  function cancelPointers() {
    endNode();
    for (const id of pointers.keys())
      if (svg.hasPointerCapture?.(id)) svg.releasePointerCapture(id);
    pointers.clear();
    pinch = undefined;
  }
  function reset() {
    revision++;
    engine?.destroy();
    engine = undefined;
    boot = undefined;
    lastMoved = undefined;
    cancelPointers();
    for (const n of nodes) {
      n.x = n.initial.x;
      n.y = n.initial.y;
    }
    view = { k: 1, x: 0, y: 0 };
    render();
  }
  on(svg, "pointerover", (event) => {
    if (targetNode(event.target)) prepare().catch(() => {});
  });
  on(svg, "focusin", (event) => {
    if (targetNode(event.target)) prepare().catch(() => {});
  });
  on(svg, "dragstart", (event) => event.preventDefault());
  on(
    svg,
    "wheel",
    (event) => {
      event.preventDefault();
      cancelPointers();
      view = zoomAt(
        view,
        point(event),
        Math.exp(
          -Math.max(
            -100,
            Math.min(100, event.deltaY * (event.deltaMode === 1 ? 16 : 1)),
          ) * 0.008,
        ),
      );
      render();
    },
    { passive: false },
  );
  on(svg, "pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    if (!pointers.size) suppressClick = false;
    pointers.set(event.pointerId, point(event));
    if (pointers.size === 1) {
      const node = targetNode(event.target);
      if (node) {
        active = {
          id: event.pointerId,
          node,
          start: point(event),
          origin: { x: node.x, y: node.y },
          dragging: false,
        };
        prepare().catch(() => {});
      }
    }
    if (pointers.size === 2) {
      endNode();
      suppressClick = true;
      const [a, b] = [...pointers.values()];
      pinch = {
        view: { ...view },
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      };
      for (const id of pointers.keys()) svg.setPointerCapture?.(id);
    }
  });
  on(win, "pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const p = point(event);
    pointers.set(event.pointerId, p);
    if (pinch && pointers.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      // Scale around the initial midpoint. Translating both fingers never pans.
      if (pinch.distance)
        view = zoomAt(
          pinch.view,
          pinch.center,
          Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance,
        );
      render();
      return;
    }
    if (!active || active.id !== event.pointerId) return;
    const dx = p.x - active.start.x,
      dy = p.y - active.start.y;
    if (!active.dragging && Math.hypot(dx, dy) <= 3) return;
    active.dragging = true;
    suppressClick = true;
    event.preventDefault();
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-node-dragging");
    active.node.element.classList.add("is-dragging");
    move(active.node, {
      x: active.origin.x + dx / view.k,
      y: active.origin.y + dy / view.k,
    });
  });
  const release = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (active?.id === event.pointerId) endNode();
    if (svg.hasPointerCapture?.(event.pointerId))
      svg.releasePointerCapture(event.pointerId);
    if (pointers.size < 2) pinch = undefined;
  };
  on(win, "pointerup", release);
  on(win, "pointercancel", release);
  on(svg, "lostpointercapture", release);
  on(win, "blur", cancelPointers);
  on(
    svg,
    "click",
    (event) => {
      if (suppressClick && event.detail !== 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      suppressClick = false;
    },
    true,
  );
  on(svg, "keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const node = targetNode(event.target),
      delta = {
        ArrowLeft: [-10, 0],
        ArrowRight: [10, 0],
        ArrowUp: [0, -10],
        ArrowDown: [0, 10],
      }[event.key];
    if (delta && node) {
      event.preventDefault();
      cancelPointers();
      move(node, {
        x: node.x + delta[0] / view.k,
        y: node.y + delta[1] / view.k,
      });
      engine?.release(node.id);
      return;
    }
    if (event.target !== svg && !node) return;
    if (["Home", "0"].includes(event.key)) {
      event.preventDefault();
      reset();
      return;
    }
    if (event.key === "Escape") {
      cancelPointers();
      return;
    }
    if (!["+", "=", "-", "_"].includes(event.key)) return;
    event.preventDefault();
    cancelPointers();
    view = zoomAt(view, center(), ["+", "="].includes(event.key) ? 1.25 : 0.8);
    render();
  });
  draw();
  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      revision++;
      engine?.destroy();
      engine = undefined;
      cancelPointers();
      listeners.forEach((off) => off());
      if (frame !== undefined) cancelAnimationFrame(frame);
      for (const n of nodes) {
        n.x = n.initial.x;
        n.y = n.initial.y;
        n.element.removeAttribute("transform");
      }
      for (const e of edges) {
        const a = byId.get(e.from)!,
          b = byId.get(e.to)!;
        e.element.setAttribute("x1", String(a.x));
        e.element.setAttribute("y1", String(a.y));
        e.element.setAttribute("x2", String(b.x));
        e.element.setAttribute("y2", String(b.y));
      }
      group.removeAttribute("transform");
      delete svg.dataset.zoom;
      svg.style.removeProperty("--graph-label-opacity");
    },
  };
}
export function initLocalGraphs() {
  const views = [
    ...document.querySelectorAll<SVGSVGElement>("svg[data-local-graph]"),
  ].map((svg) => mountLocalGraph(svg));
  return { destroy: () => views.forEach((view) => view.destroy()) };
}
