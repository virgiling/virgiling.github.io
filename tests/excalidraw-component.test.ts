import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { parseHTML } from "linkedom";
import type { DrawingOptions } from "../src/runtime/excalidraw";

// Execute the installed, patched plugin and real React lifecycle. Mock only the
// Canvas/font-dependent exporter; these tests do not claim browser rendering.
const bundle = await build({
  entryPoints: ["src/runtime/excalidraw-view.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "DrawingView",
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "svg-export-boundary",
      setup(b) {
        b.onResolve({ filter: /^@excalidraw\/excalidraw$/ }, () => ({
          path: "exporter",
          namespace: "test",
        }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            'export const THEME={LIGHT:"light",DARK:"dark"}; export const exportToSvg=(scene)=>globalThis.exportScene(scene);',
        }));
      },
    },
  ],
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
async function settle(condition: () => boolean) {
  for (let i = 0; i < 30 && !condition(); i++) await tick();
  assert.ok(condition(), "React effect did not settle");
}
function environment(
  exporter?: (scene: Record<string, unknown>) => Promise<SVGSVGElement>,
) {
  const { document, window } = parseHTML(
    '<html><body><div id="mount"></div></body></html>',
  );
  const scenes: Record<string, unknown>[] = [];
  const context = {
    document,
    window,
    navigator: { userAgent: "node-test" },
    console,
    setTimeout,
    clearTimeout,
    performance,
    exportScene: async (scene: Record<string, unknown>) => {
      scenes.push(scene);
      if (exporter) return exporter(scene);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 160 100");
      svg.setAttribute("width", "160");
      svg.setAttribute("height", "100");
      return svg;
    },
  };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const view = (
    context as typeof context & {
      DrawingView: typeof import("../src/runtime/excalidraw-view");
    }
  ).DrawingView;
  return {
    document,
    scenes,
    mount(options: DrawingOptions) {
      return view.mountDrawing(
        document.querySelector<HTMLElement>("#mount")!,
        options,
      );
    },
  };
}

test("plugin renders SVG with accessible label and size and uses light, non-embedded exports", async () => {
  const e = environment();
  let rendered = 0;
  const destroy = e.mount({
    fileContent: '{"type":"excalidraw","elements":[]}',
    alt: "Example",
    width: 320,
    height: 200,
    onRender: () => {
      rendered++;
    },
    onError: (error) => {
      throw error;
    },
  });
  await settle(() => rendered === 1);
  const svg = e.document.querySelector("svg")!;
  assert.match(
    e.document.querySelector("style")!.textContent!,
    /\.excalidraw-embed/,
  );
  assert.equal(svg.getAttribute("aria-label"), "Example");
  assert.equal(svg.getAttribute("role"), "img");
  assert.equal(svg.getAttribute("width"), "320");
  assert.equal(svg.getAttribute("height"), "200");
  assert.equal(
    JSON.stringify(e.scenes[0].appState),
    JSON.stringify({
      theme: "light",
      exportWithDarkMode: false,
      exportEmbedScene: false,
      exportBackground: false,
    }),
  );
  destroy();
  assert.equal(e.document.querySelector("svg"), null);
  assert.equal(e.document.querySelector("style"), null);
});

test("width-only sizing retains the scene viewBox ratio instead of a fixed exported height", async () => {
  const e = environment();
  let rendered = false;
  const destroy = e.mount({
    fileContent: "{}",
    alt: "Example",
    width: 900,
    onRender: () => {
      rendered = true;
    },
    onError: (error) => {
      throw error;
    },
  });
  await settle(() => rendered);
  const svg = e.document.querySelector("svg")!;
  assert.equal(svg.getAttribute("width"), "900");
  assert.equal(svg.getAttribute("height"), null);
  assert.equal(svg.getAttribute("viewBox"), "0 0 160 100");
  destroy();
});

test("export failures are reported through the patched callback", async () => {
  const failure = new Error("export failed");
  const e = environment(async () => {
    throw failure;
  });
  let error: unknown;
  const destroy = e.mount({
    fileContent: "{}",
    alt: "Example",
    onRender: () => assert.fail("unexpected SVG"),
    onError: (value) => {
      error = value;
    },
  });
  await settle(() => error !== undefined);
  assert.equal(error, failure);
  destroy();
});

test("unmount suppresses an exporter result that arrives after a preview closes", async () => {
  let resolve!: (svg: SVGSVGElement) => void;
  const e = environment(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let rendered = 0;
  const destroy = e.mount({
    fileContent: "{}",
    alt: "Example",
    onRender: () => {
      rendered++;
    },
    onError: (error) => {
      throw error;
    },
  });
  await settle(() => !!resolve);
  destroy();
  resolve(
    e.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    ) as SVGSVGElement,
  );
  await tick();
  assert.equal(rendered, 0);
  assert.equal(e.document.querySelector("svg"), null);
});
