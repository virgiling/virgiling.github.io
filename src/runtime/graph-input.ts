// Pointer, wheel, drag and keyboard input for the on-demand global graph.
import { drag, dragEnable, type D3DragEvent } from "d3-drag";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import type { SimulatedNode } from "../graph/force-simulator";
import type { GraphNode, ViewTransform } from "../graph/data";
import { fitTransform, pickNode } from "../graph/paint";
import { reduced } from "./motion";
export type LiveNode = SimulatedNode<GraphNode>;
type CanvasDragEvent = D3DragEvent<HTMLCanvasElement, unknown, LiveNode>;
export interface GraphInputOptions {
  canvas: HTMLCanvasElement;
  nodes: LiveNode[];
  current: string;
  navigate: (url: string) => void;
  repaint: () => void;
  reheat: () => void;
  size: () => { width: number; height: number };
}
export interface GraphInput {
  getTransform(): ViewTransform;
  highlight(): string | undefined;
  reset(): void;
  zoomBy(factor: number): void;
  destroy(): void;
}
export function createGraphInput({
  canvas,
  nodes,
  current,
  navigate,
  repaint,
  reheat,
  size,
}: GraphInputOptions): GraphInput {
  let transform: ViewTransform = zoomIdentity,
    draggingView: Window | null | undefined,
    dragged: LiveNode | undefined,
    hovered: string | undefined,
    focused = false;
  let selected = nodes.find((n) => n.id === `page:${current}`) || nodes[0];
  function at(event: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect(),
      point = "touches" in event ? event.touches[0] : event,
      { width, height } = size();
    return pickNode(
      nodes,
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
      [size().width, size().height],
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
    .subject((event) => pickNode(nodes, { x: event.x, y: event.y }, transform))
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
    const xs = nodes.map((n) => n.x),
      ys = nodes.map((n) => n.y),
      left = Math.min(0, ...xs) - 40,
      top = Math.min(0, ...ys) - 40;
    const { width, height } = size();
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
    const candidates = nodes
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
    const { width, height } = size();
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
  return {
    getTransform: () => transform,
    highlight: () => hovered || (focused ? selected?.id : undefined),
    reset,
    zoomBy: (factor) => selection.call(behavior.scaleBy, factor),
    destroy() {
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
    },
  };
}
