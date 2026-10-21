import assert from "node:assert/strict";
import { test } from "node:test";
import type { GraphAssets } from "../src/runtime/graph-assets";
import { graphEnvironment } from "./helpers/graph-controller";
import { environment } from "./helpers/runtime-bundle";

test("graph mounts without waiting for Motion, closes and restores focus; empty pages are a no-op", async () => {
  const g = graphEnvironment();
  assert.equal(g.trigger.hidden, false);
  g.trigger.click();
  assert.equal(g.dialog.open, true);
  assert.equal(g.opened, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    g.mounted,
    1,
    "ready graph must not wait for the entrance animation",
  );
  g.dialog.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(g.dialog.style.opacity, "");
  g.closeButton.click();
  assert.equal(g.dialog.open, false);
  assert.equal(g.document.activeElement, g.trigger);
  const empty = environment({ document: { querySelector: () => null } });
  assert.doesNotThrow(() => empty.initGraph().close());
});
test("graph Escape/backdrop cancel, inside clicks do not close; modal handoff suppresses focus restore", () => {
  const g = graphEnvironment();
  g.trigger.click();
  const inside = Object.assign(new Event("click"), {
    clientX: 80,
    clientY: 80,
  });
  g.dialog.dispatchEvent(inside);
  assert.equal(g.dialog.open, true);
  const cancel = new Event("cancel", { cancelable: true });
  g.dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(g.dialog.open, false);
  assert.ok(g.dialog.animations.every((a) => a.playState === "idle"));
  g.trigger.click();
  g.dialog.dispatchEvent(
    Object.assign(new Event("click"), { clientX: 0, clientY: 0 }),
  );
  assert.equal(g.dialog.open, false);
  g.trigger.click();
  g.controller.close({ restoreFocus: false });
  assert.notEqual(g.document.activeElement, g.trigger);
});

test("global graph load is close-safe, retryable and releases the viewer on close", async () => {
  let resolveLoad!: (assets: GraphAssets) => void;
  const late = graphEnvironment(
    () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
  );
  late.trigger.click();
  late.closeButton.click();
  resolveLoad({ data: {}, mount: late.mount });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(late.mounted, 0);
  let attempts = 0;
  const retry = graphEnvironment(() =>
    ++attempts === 1
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ data: {}, mount: retry.mount }),
  );
  retry.trigger.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(retry.retry.hidden, false);
  assert.ok(retry.status.textContent.includes("加载失败"));
  retry.retry.click();
  retry.dialog.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(retry.mounted, 1);
  assert.equal(retry.status.hidden, true);
  retry.closeButton.click();
  assert.equal(retry.destroyed, 1);
});
test("global graph fetch is lazy, shared and retryable", async () => {
  let loads = 0;
  const data = { version: 1 };
  const runtime = environment({
    document: { body: { dataset: { graphIndex: "/preview/data/graph.json" } } },
    fetch: async (url: string) => {
      assert.equal(url, "/preview/data/graph.json");
      loads++;
      return { ok: loads > 1, json: async () => data };
    },
  });
  assert.equal(loads, 0);
  const first = runtime.loadGraphAssets(),
    same = runtime.loadGraphAssets();
  assert.equal(first, same);
  await assert.rejects(first);
  const result = await runtime.loadGraphAssets();
  assert.equal(result.data, data);
  assert.equal(typeof result.mount, "function");
  assert.equal(await runtime.loadGraphAssets(), result);
  assert.equal(loads, 2);
});
