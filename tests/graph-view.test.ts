// Canvas boundary doubles, real bundled D3 input API; no browser or pixel assertions.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  graphEnvironment,
  type CanvasCall,
  type CanvasTextCall,
} from "./helpers/graph-environment";
import type { GraphData } from "../src/runtime/graph-view";
const { build } = createRequire(new URL("../package.json", import.meta.url))(
  "esbuild",
);
const bundle = await build({
  entryPoints: ["src/runtime/graph-view.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "Viewer",
});
const graph: GraphData = {
  version: 1,
  width: 1000,
  height: 500,
  nodes: [
    {
      id: "page:a",
      type: "page",
      label: "<A>",
      url: "/preview/articles/a",
      x: 500,
      y: 300,
    },
    {
      id: "tag:主题",
      type: "tag",
      label: "主题",
      path: "主题",
      url: "/preview/tags/a",
      x: 500,
      y: 80,
    },
  ],
  edges: [{ from: "page:a", to: "tag:主题", type: "tag-membership" }],
};
const environment = (options: Parameters<typeof graphEnvironment>[1] = {}) =>
  graphEnvironment(bundle.outputFiles[0].text, options);
test("global data validation, zoom-aware picking and distinct hollow/solid Canvas shapes", () => {
  const e = environment(),
    v = e.viewer;
  assert.equal(v.validateGraph(graph), graph);
  assert.throws(() =>
    v.validateGraph({
      ...graph,
      nodes: [{ ...graph.nodes[0], url: "javascript:alert(1)" }],
    }),
  );
  assert.throws(() =>
    v.validateGraph({
      ...graph,
      edges: [{ from: "missing", to: "page:a", type: "page-link" }],
    }),
  );
  const t = v.fitTransform(graph, 900, 500);
  assert.ok(t.k > 0 && t.k <= 5);
  assert.equal(
    v.pickNode(graph.nodes, { x: 500 * t.k + t.x, y: 300 * t.k + t.y }, t)!.id,
    "page:a",
  );
  assert.equal(v.pickNode(graph.nodes, { x: -100, y: -100 }, t), undefined);
  const mounted = v.mountGraph(e.host, graph, { current: "a" });
  e.paint();
  assert.equal(
    e.calls.filter((c) => c[0] === "arc").length,
    3,
    "two tag rings and one page circle",
  );
  assert.equal(
    e.calls.filter((c) => c[0] === "fill").length,
    1,
    "only page node is filled",
  );
  assert.equal(e.host.children.length, 2, "no expanded node list");
  assert.equal(e.host.children[1].attrs.role, "application");
  mounted.destroy();
});
test("Canvas radius, hit target and label placement follow bounded node metrics; zoom reveals ordinary titles", () => {
  const e = environment(),
    v = e.viewer,
    data = {
      ...graph,
      nodes: graph.nodes.map((n, i) => ({ ...n, radius: i ? 5 : 12 })),
    };
  v.paintGraph(
    Object.fromEntries(
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
        (...args: unknown[]) => e.calls.push([name, ...args] as CanvasCall),
      ]),
    ),
    data,
    { width: 900, height: 500, transform: { x: 0, y: 0, k: 1 } },
  );
  assert.deepEqual(
    e.calls.filter((c) => c[0] === "arc").map((c) => c[3]),
    [12, 5, 2.5],
  );
  assert.equal(e.calls.filter((c) => c[0] === "fillText").length, 0);
  assert.equal(
    v.pickNode(data.nodes, { x: 514, y: 300 }, { x: 0, y: 0, k: 1 })!.id,
    "page:a",
    "hit area follows large radius",
  );
  const mounted = v.mountGraph(e.host, data);
  e.paint();
  e.host.children[1].dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), { key: "+" }),
  );
  for (let i = 0; i < 5; i++) e.host.children[0].children[1].click();
  e.paint();
  assert.ok(e.calls.some((c) => c[0] === "fillText" && c[1] === "主题"));
  mounted.destroy();
  e.paint();
});
test("Canvas-only glyph loading is requested lazily and cannot repaint a destroyed graph", async () => {
  const e = environment();
  let finish!: (value: unknown[]) => void,
    text = "";
  e.doc.fonts.load = (_font, characters) => {
    text = characters;
    return new Promise((resolve) => (finish = resolve));
  };
  const mounted = e.viewer.mountGraph(e.host, graph);
  assert.equal(text.includes("主题"), true);
  mounted.destroy();
  e.paint();
  finish([]);
  await Promise.resolve();
  assert.equal(e.frames.size, 0);
});
test("viewer coalesces draws, caps backing ratio, supports reset controls and destroys resources", async () => {
  const e = environment(),
    mounted = e.viewer.mountGraph(e.host, graph);
  assert.equal(e.frames.size, 2, "coalesced paint plus Motion scheduler");
  const [controls, canvas] = e.host.children;
  assert.equal(canvas.width, 1800);
  assert.equal(canvas.height, 1000);
  controls.children[1].click();
  controls.children[2].click();
  assert.equal(e.frames.size, 2);
  canvas.dispatchEvent(
    Object.assign(new Event("mousedown", { cancelable: true }), {
      view: e.view,
      clientX: 10,
      clientY: 10,
      button: 0,
      ctrlKey: false,
    }),
  );
  assert.equal(e.view.document.documentElement.style.MozUserSelect, "none");
  mounted.destroy();
  e.paint();
  assert.equal(e.view.__on?.length || 0, 0);
  assert.equal(e.view.document.documentElement.style.MozUserSelect, "text");
  assert.equal(e.frames.size, 0);
  assert.equal(e.disconnected, 1);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.__on?.length || 0, 0);
  assert.equal(e.host.children.length, 0);
  await Promise.resolve();
  assert.equal(
    e.frames.size,
    0,
    "font completion must not revive a destroyed viewer",
  );
});
test("missing Canvas reports failure without resurrecting the removed lists", () => {
  const e = environment({ canvas: false });
  assert.throws(() => e.viewer.mountGraph(e.host, graph), /Canvas/);
  assert.equal(e.host.children.length, 0);
  assert.equal(e.frames.size, 0);
});
test("real D3 drag moves a node, resumes Motion force relaxation, supports keyboard links, and never mutates cached JSON", () => {
  const e = environment(),
    before = JSON.stringify(graph),
    visited: string[] = [],
    mounted = e.viewer.mountGraph(e.host, graph, {
      current: "a",
      navigate: (url) => visited.push(url),
    }),
    canvas = e.host.children[1];
  e.paint();
  const label = e.calls.find(
      (c): c is CanvasTextCall => c[0] === "fillText" && c[1] === "<A>",
    )!,
    transform = canvas.__zoom;
  const mouse = (type: string, x: number, y: number) =>
    Object.assign(new Event(type, { cancelable: true }), {
      view: e.view,
      clientX: x,
      clientY: y,
      button: 0,
      ctrlKey: false,
    });
  const x = label[2] * transform.k + transform.x,
    y = (label[3] - 20) * transform.k + transform.y;
  canvas.dispatchEvent(mouse("mousedown", x, y));
  e.view.dispatchEvent(mouse("mousemove", x + 60, y + 30));
  e.view.dispatchEvent(mouse("mouseup", x + 60, y + 30));
  for (let i = 0; i < 5; i++) e.paint();
  const drawn = e.calls.filter(
    (c): c is CanvasTextCall => c[0] === "fillText" && c[1] === "<A>",
  );
  assert.notEqual(drawn.at(-1)![2], label[2]);
  assert.equal(JSON.stringify(graph), before);
  canvas.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), { key: "Enter" }),
  );
  assert.deepEqual(visited, ["/preview/articles/a"]);
  mounted.destroy();
  e.paint();
  assert.equal(e.frames.size, 0);
});
test("reduced-motion and hidden-document changes stop ongoing simulation scheduling", () => {
  const e = environment(),
    mounted = e.viewer.mountGraph(e.host, graph);
  e.paint();
  e.doc.hidden = true;
  e.doc.dispatchEvent(new Event("visibilitychange"));
  e.paint();
  assert.equal(e.frames.size, 0);
  e.doc.hidden = false;
  e.doc.dispatchEvent(new Event("visibilitychange"));
  assert.ok(e.frames.size > 0);
  e.media.matches = true;
  e.media.dispatchEvent(new Event("change"));
  e.paint();
  e.paint();
  assert.equal(e.frames.size, 0);
  mounted.destroy();
  e.paint();
  assert.equal(e.frames.size, 0);
});
