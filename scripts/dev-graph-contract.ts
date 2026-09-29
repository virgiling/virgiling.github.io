import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { graphEnvironment } from "../tests/helpers/graph-environment";
import { parseHTML } from "linkedom";
import { required, rect } from "../tests/helpers/dom";
import type { mountLocalGraph } from "../src/runtime/local-graph";

// Exercise actual HTTP-served Vite dependency boundaries, not a fresh bundle of
// node_modules (which can hide duplicated/missing prototype side effects).
// Canvas/DOM boundaries are Node doubles, not a browser or a rendering check.
export async function verifyDevGraph(
  origin: string,
  base = "/",
  evidenceLabel?: string,
) {
  const sources = new Map<string, string>();
  async function get(path: string) {
    const href = new URL(path, origin).href;
    assert.equal(new URL(href).origin, origin);
    const response = await fetch(href, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, href);
    return response;
  }
  const home = await (await get(base)).text(),
    path = /data-graph-index="([^"]+)"/.exec(home)?.[1];
  assert.ok(path);
  const payload: unknown = await (await get(path)).json();
  const bundle = await build({
    stdin: {
      contents: ["graph-view.ts", "local-graph.ts"]
        .map(
          (file) =>
            `export * from ${JSON.stringify(origin + base + "src/runtime/" + file)};`,
        )
        .join("\n"),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "Viewer",
    plugins: [
      {
        name: "local-http-modules",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            const url = new URL(
              args.path,
              args.namespace === "local-http" ? args.importer : origin,
            ).href;
            assert.equal(new URL(url).origin, origin);
            return { path: url, namespace: "local-http" };
          });
          b.onLoad({ filter: /.*/, namespace: "local-http" }, async (args) => {
            const contents = await (await get(args.path)).text();
            sources.set(args.path, contents);
            return { contents, loader: "js" };
          });
        },
      },
    ],
  });
  if (evidenceLabel) {
    await mkdir(".astro/reports", { recursive: true });
    await writeFile(
      `.astro/reports/graph-${evidenceLabel}-modules.json`,
      JSON.stringify([...sources], null, 2),
    );
    await writeFile(
      `.astro/reports/graph-${evidenceLabel}-bundle.js`,
      bundle.outputFiles[0].text,
    );
  }
  const env = graphEnvironment<{ mountLocalGraph: typeof mountLocalGraph }>(
      bundle.outputFiles[0].text,
    ),
    data = env.viewer.validateGraph(payload),
    mounted = env.viewer.mountGraph(env.host, data);
  env.paint();
  assert.equal(
    env.calls.filter((c) => c[0] === "arc").length,
    data.nodes.reduce((n, node) => n + (node.type === "tag" ? 2 : 1), 0),
  );
  assert.ok(
    typeof payload === "object" && payload !== null && "layout" in payload,
  );
  assert.equal(payload.layout, "force");
  const [controls] = env.host.children;
  controls.children[1].click();
  controls.children[2].click();
  env.paint();
  mounted.destroy();
  env.paint();
  assert.equal(env.frames.size, 0);
  assert.equal(env.host.children.length, 0);
  const { window, document } = parseHTML(home),
    svg = required<SVGSVGElement>(document, "svg[data-local-graph]");
  const viewBox = svg.getAttribute("viewBox");
  assert.ok(viewBox);
  const box = viewBox.split(" ").map(Number);
  Object.defineProperty(svg, "viewBox", {
    value: { baseVal: { x: box[0], y: box[1], width: box[2], height: box[3] } },
  });
  svg.getBoundingClientRect = () => rect(0, 0, box[2], box[3]);
  const local = env.viewer.mountLocalGraph(svg),
    node = required<SVGAElement>(svg, "a[aria-current]"),
    hit = required<SVGCircleElement>(node, ".graph-hit"),
    group = required<SVGGElement>(svg, "[data-graph-transform]");
  const x = Number(hit.getAttribute("cx")),
    y = Number(hit.getAttribute("cy"));
  const emit = (target: EventTarget, type: string, px: number, py: number) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: px, clientY: py });
    target.dispatchEvent(event);
  };
  emit(hit, "pointerdown", x, y);
  emit(window, "pointermove", x + 12, y + 8);
  await new Promise((resolve) => setImmediate(resolve));
  env.paint();
  assert.equal(node.getAttribute("transform"), "translate(12 8)");
  assert.equal(group.getAttribute("transform"), "translate(0 0) scale(1)");
  emit(window, "pointerup", x + 12, y + 8);
  assert.equal(
    node.getAttribute("transform"),
    "translate(12 8)",
    "release must not teleport",
  );
  for (let i = 0; i < 4; i++) env.paint();
  assert.notEqual(node.getAttribute("transform"), "translate(12 8)");
  assert.notEqual(node.getAttribute("transform"), "translate(0 0)");
  Object.defineProperty(document, "hidden", { value: true, writable: true });
  document.dispatchEvent(new window.Event("visibilitychange"));
  env.paint();
  const paused = node.getAttribute("transform");
  for (let i = 0; i < 5; i++) env.paint();
  assert.equal(node.getAttribute("transform"), paused);
  Object.defineProperty(document, "hidden", { value: false });
  document.dispatchEvent(new window.Event("visibilitychange"));
  for (let i = 0; i < 185; i++) env.paint();
  assert.equal(
    node.getAttribute("transform"),
    "translate(0 0)",
    "current node springs back to the original center",
  );
  emit(hit, "pointerdown", x, y);
  emit(window, "pointermove", x - 20, y - 15);
  env.paint();
  emit(window, "pointerup", x - 20, y - 15);
  Object.assign(env.media, { matches: true });
  env.media.dispatchEvent(new Event("change"));
  env.paint();
  assert.equal(
    node.getAttribute("transform"),
    "translate(0 0)",
    "runtime reduced motion settles immediately",
  );
  assert.equal(group.getAttribute("transform"), "translate(0 0) scale(1)");
  local.destroy();
  env.paint();
  assert.equal(env.frames.size, 0);
  assert.equal(node.getAttribute("transform"), null);
  return {
    status: "passed",
    base,
    modules: sources.size,
    nodes: data.nodes.length,
    edges: data.edges.length,
    localNodeDrag:
      "served SVG + actual lazy force module; center rebound, pause/resume/reduced-motion, no background pan and cleanup passed",
    scope: "HTTP-served Vite modules + Node DOM/Canvas boundary; no browser",
  };
}
