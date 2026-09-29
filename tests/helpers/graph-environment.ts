// Node boundary doubles only: no browser, DOM implementation or pixel rendering.
import { runInNewContext } from "node:vm";
import type * as Viewer from "../../src/runtime/graph-view";
import type { ZoomTransform } from "d3-zoom";
export type CanvasTextCall = ["fillText", string, number, number];
type NumericMethod =
  | "setTransform"
  | "clearRect"
  | "translate"
  | "scale"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
  | "arc"
  | "fill";
export type CanvasCall =
  CanvasTextCall | ["setLineDash", number[]] | [NumericMethod, ...number[]];
type TestViewer = Omit<typeof Viewer, "mountGraph" | "paintGraph"> & {
  // The VM receives deliberately partial DOM/Canvas doubles, not browser objects.
  mountGraph(
    host: object,
    data: unknown,
    options?: Parameters<typeof Viewer.mountGraph>[2],
  ): ReturnType<typeof Viewer.mountGraph>;
  paintGraph(
    ctx: object,
    data: Parameters<typeof Viewer.paintGraph>[1],
    options: Parameters<typeof Viewer.paintGraph>[2],
  ): void;
};
export function graphEnvironment<Extra extends object = {}>(
  code: string,
  { canvas = true, reducedMotion = false } = {},
) {
  const calls: CanvasCall[] = [],
    frames = new Map<number, FrameRequestCallback>();
  let count = 0,
    disconnected = 0,
    time = 0;
  const ctx = Object.fromEntries(
    [
      "setTransform",
      "clearRect",
      "translate",
      "scale",
      "beginPath",
      "setLineDash",
      "moveTo",
      "lineTo",
      "stroke",
      "arc",
      "fill",
      "fillText",
    ].map((name) => [
      name,
      (...args: unknown[]) => {
        calls.push([name, ...args] as CanvasCall);
      },
    ]),
  );
  class Element extends EventTarget {
    clientWidth = 900;
    clientHeight = 500;
    clientLeft = 0;
    clientTop = 0;
    width = 0;
    height = 0;
    children: Element[] = [];
    attrs: Record<string, string> = {};
    parentNode?: Element;
    style = { setProperty() {}, removeProperty() {} };
    ownerDocument = doc;
    __on?: unknown[];
    __zoom!: ZoomTransform;
    constructor(public tagName: string) {
      super();
    }
    append(...nodes: Element[]) {
      this.children.push(...nodes);
      nodes.forEach((n) => (n.parentNode = this));
    }
    replaceChildren(...nodes: Element[]) {
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      if (this.parentNode)
        this.parentNode.children = this.parentNode.children.filter(
          (n) => n !== this,
        );
    }
    setAttribute(key: string, value: string) {
      this.attrs[key] = value;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 900, height: 500 };
    }
    getContext() {
      return canvas ? ctx : null;
    }
    click() {
      this.dispatchEvent(new Event("click"));
    }
  }
  class Document extends EventTarget {
    hidden = false;
    defaultView!: Window;
    fonts: {
      ready: Promise<void>;
      load?: (font: string, text: string) => Promise<unknown[]>;
    } = { ready: Promise.resolve() };
    documentElement = { style: { MozUserSelect: "text" } };
    createElement(tag: string): Element {
      return new Element(tag);
    }
  }
  class Window extends EventTarget {
    document!: Document;
    __on?: unknown[];
  }
  const doc = new Document(),
    view = new Window();
  view.document = doc;
  doc.defaultView = view;
  const media = Object.assign(new EventTarget(), { matches: reducedMotion });
  const context = {
    console,
    document: doc,
    navigator: { maxTouchPoints: 0 },
    devicePixelRatio: 4,
    performance: { now: () => time },
    matchMedia: () => media,
    getComputedStyle: () => ({ fontFamily: "serif" }),
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++count, fn);
      return count;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    ResizeObserver: class {
      observe() {}
      disconnect() {
        disconnected++;
      }
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
  };
  runInNewContext(code, context);
  const { Viewer: viewer } = context as typeof context & {
    Viewer: TestViewer & Extra;
  };
  return {
    viewer,
    host: new Element("div"),
    calls,
    frames,
    view,
    doc,
    media,
    get disconnected() {
      return disconnected;
    },
    paint() {
      time += 1000 / 60;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(time));
    },
  };
}
