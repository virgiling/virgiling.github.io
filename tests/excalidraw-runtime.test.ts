import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { parseHTML } from "linkedom";
import type {
  DrawingOptions,
  DrawingRenderer,
} from "../src/runtime/excalidraw";

const bundle = await build({
  entryPoints: ["src/runtime/excalidraw.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "DrawingLoader",
  external: ["./excalidraw-view"],
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
const markup =
  '<figure data-excalidraw="/preview/media/scene.excalidraw.json" data-label="Example" data-width="320"><p><a href="/preview/media/scene.excalidraw.json">Download</a></p></figure>';
function environment(html = markup) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  let callback: (
    entries: { isIntersecting: boolean; target: Element }[],
  ) => void;
  const observed = new Set<Element>();
  class Visibility {
    constructor(fn: typeof callback) {
      callback = fn;
    }
    observe(node: Element) {
      observed.add(node);
    }
    unobserve(node: Element) {
      observed.delete(node);
    }
    disconnect() {
      observed.clear();
    }
  }
  const context = {
    document,
    MutationObserver: window.MutationObserver,
    IntersectionObserver: Visibility,
    AbortController,
    performance,
    fetch,
  };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const runtime = (
    context as typeof context & {
      DrawingLoader: typeof import("../src/runtime/excalidraw");
    }
  ).DrawingLoader;
  let loads = 0,
    requests = 0,
    unmounts = 0;
  const mounted: { target: HTMLElement; options: DrawingOptions }[] = [];
  const renderer: DrawingRenderer = {
    mountDrawing(target, options) {
      mounted.push({ target, options });
      return () => {
        unmounts++;
      };
    },
  };
  const init = (overrides: Parameters<typeof runtime.initExcalidraw>[0] = {}) =>
    runtime.initExcalidraw({
      root: document,
      load: async () => {
        loads++;
        return renderer;
      },
      fetcher: async (input: Parameters<typeof fetch>[0]) => {
        assert.equal(input, "/preview/media/scene.excalidraw.json");
        requests++;
        return new Response('{"type":"excalidraw","elements":[]}');
      },
      ...overrides,
    });
  return {
    document,
    window,
    observed,
    mounted,
    renderer,
    init,
    visible(node = document.querySelector("figure")!) {
      callback([{ isIntersecting: true, target: node }]);
    },
    stats: () => ({ loads, requests, unmounts }),
  };
}

test("pages without diagrams do not import React or fetch scenes", async () => {
  const e = environment("<p>No drawings</p>"),
    controller = e.init();
  await tick();
  assert.deepEqual(e.stats(), { loads: 0, requests: 0, unmounts: 0 });
  controller.destroy();
});

test("drawings load near the viewport, share a renderer and report readiness, not just fetch completion", async () => {
  const e = environment(markup + markup),
    controller = e.init();
  assert.equal(e.observed.size, 2);
  assert.equal(e.stats().loads, 0);
  const figures = [...e.document.querySelectorAll<HTMLElement>("figure")];
  for (const figure of figures) e.visible(figure);
  await tick();
  assert.deepEqual(e.stats(), { loads: 1, requests: 2, unmounts: 0 });
  assert.equal(e.mounted.length, 2);
  assert.equal(e.mounted[0].options.width, 320);
  assert.equal(e.mounted[0].options.alt, "Example");
  assert.equal(figures[0].getAttribute("aria-busy"), "true");
  e.mounted[0].options.onRender();
  assert.equal(figures[0].hasAttribute("aria-busy"), false);
  assert.match(figures[0].dataset.renderMs!, /^\d+$/);
  controller.destroy();
  assert.equal(e.stats().unmounts, 2);
  assert.equal(figures[0].querySelector("a")?.textContent, "Download");
});

test("preview additions are discovered and detached preview roots are unmounted", async () => {
  const e = environment(""),
    controller = e.init();
  e.document.body.innerHTML = markup;
  await tick();
  assert.equal(e.observed.size, 1);
  e.visible();
  await tick();
  e.document.querySelector("figure")!.remove();
  await tick();
  assert.equal(e.stats().unmounts, 1);
  controller.destroy();
});

test("request and renderer errors offer retry without a blank drawing", async () => {
  const e = environment();
  let attempts = 0;
  const controller = e.init({
    fetcher: async () =>
      new Response("{}", { status: ++attempts === 1 ? 503 : 200 }),
  });
  e.visible();
  await tick();
  const figure = e.document.querySelector("figure")!;
  assert.match(figure.textContent!, /加载失败/);
  const retry = figure.querySelector<HTMLButtonElement>("button")!;
  assert.equal(retry.hidden, false);
  retry.click();
  await tick();
  assert.equal(e.mounted.length, 1);
  e.mounted[0].options.onError(new Error("render failed"));
  assert.equal(retry.hidden, false);
  retry.click();
  await tick();
  assert.equal(e.stats().unmounts, 1);
  e.mounted[1].options.onRender();
  assert.equal(figure.querySelector("button"), null);
  controller.destroy();
});

test("destroy aborts pending fetches and ignores late lazy imports", async () => {
  const e = environment();
  let resolve!: (renderer: DrawingRenderer) => void;
  let signal: AbortSignal | null | undefined;
  const controller = e.init({
    load: () =>
      new Promise((done) => {
        resolve = done;
      }),
    fetcher: async (
      _: Parameters<typeof fetch>[0],
      options?: Parameters<typeof fetch>[1],
    ) => {
      signal = options?.signal;
      return new Response("{}");
    },
  });
  e.visible();
  controller.destroy();
  assert.equal(signal?.aborted, true);
  resolve(e.renderer);
  await tick();
  assert.equal(e.mounted.length, 0);
  assert.equal(e.document.querySelector("button"), null);
});
