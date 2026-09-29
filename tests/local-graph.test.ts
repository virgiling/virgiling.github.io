// Real SVG DOM via Linkedom, controlled pointer/RAF boundaries; not a browser.
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { mountLocalGraph, zoomAt } from "../src/runtime/local-graph.ts";
import { renderComponent } from "./helpers/render-astro.ts";
import { required, rect } from "./helpers/dom";
type ForceModule = typeof import("../src/runtime/local-graph-force");
const html = await renderComponent("LocalGraph", {
  note: { slug: "a", title: "A", url: "/a", tags: ["topic"], links: ["b"] },
  neighbors: [{ slug: "b", title: "B", url: "/b", tags: [], links: [] }],
});
function environment(
  t: TestContext,
  options: Parameters<typeof mountLocalGraph>[1] = {},
) {
  const { window, document } = parseHTML(`<html><body>${html}</body></html>`),
    svg = required<SVGSVGElement>(document, "svg[data-local-graph]"),
    group = required<SVGGElement>(svg, "[data-graph-transform]");
  const frames = new Map<number, FrameRequestCallback>(),
    captures = new Set<number>();
  let next = 0;
  const original = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++next, fn);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  Object.defineProperty(svg, "viewBox", {
    value: { baseVal: { x: 0, y: 0, width: 300, height: 250 } },
  });
  svg.getBoundingClientRect = () => rect(20, 10, 600, 500);
  svg.setPointerCapture = (id) => captures.add(id);
  svg.hasPointerCapture = (id) => captures.has(id);
  svg.releasePointerCapture = (id) => captures.delete(id);
  const mounted = mountLocalGraph(svg, {
    load: async () => {
      throw new Error("offline");
    },
    ...options,
  });
  t.after(() => {
    mounted.destroy();
    Object.assign(globalThis, original);
  });
  const emit = (
    target: EventTarget | null,
    type: string,
    props: Record<string, unknown> = {},
  ) => {
    assert.ok(target);
    const event = new window.Event(type, { cancelable: true, bubbles: true });
    Object.assign(event, props);
    target.dispatchEvent(event);
    return event;
  };
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(0));
  };
  const node = (id: string) =>
    required<SVGAElement>(svg, `a[data-node-id="${id}"]`);
  const origin = (id: string) => {
    const hit = required<SVGCircleElement>(node(id), ".graph-hit");
    return {
      x: Number(hit.getAttribute("cx")),
      y: Number(hit.getAttribute("cy")),
    };
  };
  const pointer = (id: number, x: number, y: number) => ({
    button: 0,
    pointerId: id,
    clientX: 20 + x * 2,
    clientY: 10 + y * 2,
  });
  const drag = (id: string, dx: number, dy: number) => {
    const p = origin(id);
    emit(
      node(id).querySelector(".graph-hit"),
      "pointerdown",
      pointer(1, p.x, p.y),
    );
    emit(window, "pointermove", pointer(1, p.x + dx, p.y + dy));
    paint();
    emit(window, "pointerup", pointer(1, p.x + dx, p.y + dy));
  };
  return {
    svg,
    group,
    window,
    frames,
    captures,
    mounted,
    emit,
    paint,
    node,
    origin,
    pointer,
    drag,
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test("zoom is anchored and bounded, and background dragging/arrows do not pan", (t) => {
  assert.deepEqual(zoomAt({ k: 1, x: 0, y: 0 }, { x: 80, y: 40 }, 2), {
    k: 2,
    x: -80,
    y: -40,
  });
  assert.equal(zoomAt({ k: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 100).k, 6);
  const e = environment(t);
  e.emit(e.svg, "pointerdown", e.pointer(1, 10, 10));
  e.emit(e.window, "pointermove", e.pointer(1, 70, 30));
  e.paint();
  e.emit(e.window, "pointerup", e.pointer(1, 70, 30));
  e.emit(e.svg, "keydown", { key: "ArrowRight" });
  e.paint();
  assert.equal(e.group.getAttribute("transform"), "translate(0 0) scale(1)");
  assert.equal(e.captures.size, 0);
});
test("page, tag and current nodes drag with incident edges, never translating the viewport", (t) => {
  const e = environment(t);
  for (const id of ["page:b", "tag:topic", "page:a"]) {
    const p = e.origin(id);
    e.drag(id, 8, 6);
    assert.equal(e.node(id).getAttribute("transform"), "translate(8 6)");
    for (const line of e.group.querySelectorAll("line")) {
      if (line.dataset.from === id) {
        assert.equal(Number(line.getAttribute("x1")), p.x + 8);
        assert.equal(Number(line.getAttribute("y1")), p.y + 6);
      }
      if (line.dataset.to === id) {
        assert.equal(Number(line.getAttribute("x2")), p.x + 8);
        assert.equal(Number(line.getAttribute("y2")), p.y + 6);
      }
    }
    assert.equal(e.group.getAttribute("transform"), "translate(0 0) scale(1)");
    e.emit(e.svg, "keydown", { key: "Home" });
    e.paint();
  }
});
test("zoomed drag uses world coordinates; reset restores positions, labels and view", (t) => {
  const e = environment(t);
  e.emit(e.svg, "keydown", { key: "+" });
  e.paint();
  const view = e.group.getAttribute("transform");
  e.drag("page:b", 10, 5);
  assert.equal(e.node("page:b").getAttribute("transform"), "translate(8 4)");
  assert.equal(e.group.getAttribute("transform"), view);
  assert.ok(+e.svg.style.getPropertyValue("--graph-label-opacity") > 0);
  e.emit(e.svg, "keydown", { key: "0" });
  e.paint();
  assert.equal(e.node("page:b").getAttribute("transform"), "translate(0 0)");
  assert.equal(e.svg.style.getPropertyValue("--graph-label-opacity"), "0");
});
test("drag suppresses accidental navigation while clicks, modified links and Enter stay native", (t) => {
  const e = environment(t);
  e.drag("page:b", 8, 6);
  assert.equal(e.emit(e.svg, "click", { detail: 1 }).defaultPrevented, true);
  assert.equal(
    e.emit(e.node("page:b"), "click", { detail: 0 }).defaultPrevented,
    false,
  );
  const p = e.origin("page:b");
  e.emit(e.node("page:b"), "pointerdown", {
    ...e.pointer(1, p.x, p.y),
    ctrlKey: true,
  });
  e.emit(e.window, "pointermove", e.pointer(1, p.x + 40, p.y + 30));
  e.paint();
  assert.equal(e.node("page:b").getAttribute("transform"), "translate(8 6)");
  assert.equal(
    e.emit(e.node("page:b"), "click", { detail: 1, ctrlKey: true })
      .defaultPrevented,
    false,
  );
  assert.equal(
    e.emit(e.node("page:b"), "keydown", { key: "Enter" }).defaultPrevented,
    false,
  );
  assert.equal(e.emit(e.node("page:b"), "dragstart").defaultPrevented, true);
});
test("keyboard moves focused nodes; wheel/pinch zoom without a two-finger pan", (t) => {
  const e = environment(t);
  e.emit(e.node("page:b"), "keydown", { key: "ArrowRight" });
  e.paint();
  assert.equal(e.node("page:b").getAttribute("transform"), "translate(10 0)");
  e.emit(e.svg, "pointerdown", e.pointer(1, 50, 50));
  e.emit(e.svg, "pointerdown", e.pointer(2, 150, 50));
  e.emit(e.window, "pointermove", e.pointer(1, 70, 70));
  e.emit(e.window, "pointermove", e.pointer(2, 170, 70));
  e.paint();
  assert.equal(e.group.getAttribute("transform"), "translate(0 0) scale(1)");
  e.emit(e.window, "pointermove", e.pointer(2, 270, 70));
  e.paint();
  assert.equal(e.svg.dataset.zoom, "2");
  e.emit(e.svg, "wheel", { ...e.pointer(0, 80, 40), deltaY: 20, deltaMode: 0 });
  e.paint();
  assert.ok(Number(e.svg.dataset.zoom) < 2);
  assert.equal(e.captures.size, 0);
});
test("pointer cancellation clears capture/drag state, and destroy restores static SVG including edges", (t) => {
  const e = environment(t),
    p = e.origin("page:b");
  e.emit(e.node("page:b"), "pointerdown", e.pointer(1, p.x, p.y));
  e.emit(e.window, "pointermove", e.pointer(1, p.x + 8, p.y + 6));
  e.paint();
  assert.equal(e.captures.size, 1);
  assert.ok(e.svg.classList.contains("is-node-dragging"));
  e.emit(e.window, "pointercancel", e.pointer(1, p.x + 8, p.y + 6));
  assert.equal(e.captures.size, 0);
  assert.ok(!e.svg.classList.contains("is-node-dragging"));
  e.emit(e.node("page:b"), "keydown", { key: "ArrowRight" });
  e.mounted.destroy();
  assert.equal(e.frames.size, 0);
  assert.equal(e.node("page:b").getAttribute("transform"), null);
  assert.equal(e.group.getAttribute("transform"), null);
  const line = required<SVGLineElement>(e.group, 'line[data-to="page:b"]');
  assert.equal(Number(line.getAttribute("x2")), p.x);
  assert.equal(Number(line.getAttribute("y2")), p.y);
});
test("lazy engine receives only local nodes/edges and catches early release", async (t) => {
  let resolve!: (module: ForceModule) => void,
    loads = 0,
    mounts = 0,
    moves: [string, number, number][] = [],
    releases: string[] = [],
    destroyed = 0;
  const e = environment(t, {
    load: () => {
      loads++;
      return new Promise((r) => (resolve = r));
    },
  });
  e.drag("page:b", 8, 6);
  await flush();
  assert.equal(loads, 1);
  resolve({
    mountLocalForce(model) {
      mounts++;
      assert.equal(model.nodes.length, 3);
      assert.equal(model.edges.length, 2);
      return {
        move: (...args) => moves.push(args),
        release: (id) => releases.push(id),
        destroy: () => destroyed++,
      };
    },
  });
  await flush();
  assert.equal(mounts, 1);
  assert.equal(moves[0][0], "page:b");
  assert.deepEqual(releases, ["page:b"]);
  e.emit(e.svg, "keydown", { key: "Home" });
  e.paint();
  assert.equal(destroyed, 1);
  e.mounted.destroy();
  await flush();
  assert.equal(e.frames.size, 0);
});
test("late engine import cannot revive a view after reset/destroy", async (t) => {
  let finish!: (module: ForceModule) => void,
    mounts = 0;
  const late = environment(t, { load: () => new Promise((r) => (finish = r)) });
  late.drag("page:b", 8, 6);
  await flush();
  late.emit(late.svg, "keydown", { key: "Home" });
  late.mounted.destroy();
  finish({
    mountLocalForce() {
      mounts++;
      throw new Error("Disposed graph must not mount");
    },
  });
  await flush();
  assert.equal(mounts, 0);
  assert.equal(late.frames.size, 0);
});
test("failed physics import leaves direct drag usable and retries on a later gesture", async (t) => {
  let attempts = 0,
    mounted = 0;
  const e = environment(t, {
    load: async () => {
      if (++attempts === 1) throw new Error("offline");
      return {
        mountLocalForce() {
          mounted++;
          return { move() {}, release() {}, destroy() {} };
        },
      };
    },
  });
  e.drag("page:b", 5, 5);
  await flush();
  assert.equal(e.node("page:b").getAttribute("transform"), "translate(5 5)");
  e.drag("page:b", 6, 4);
  await flush();
  assert.ok(attempts >= 2);
  assert.equal(mounted, 1);
});
