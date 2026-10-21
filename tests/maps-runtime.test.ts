// Node DOM/controller tests with Leaflet and Motion boundaries, not browser acceptance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { initMaps as initMapsController } from "../src/runtime/maps";
import { loadMapStyles } from "../src/runtime/map-styles";
import { dom, initMaps, tick } from "./helpers/map-runtime";
import type { MapRuntime } from "./helpers/map-runtime";
test("map engine waits for visibility, supports retry, and releases its observer and view", async () => {
  const { document, root, retry, status } = dom();
  let show = () => {},
    attempts = 0,
    mounts = 0,
    destroyed = 0,
    stopped = 0;
  const maps = initMaps({
    root: document,
    observe: (_element, callback) => {
      show = callback;
      return () => stopped++;
    },
    load: async () => {
      if (++attempts === 1) throw new Error("network");
      return {
        stylesheet: "/leaflet.css",
        mountMapView: (element, points) => {
          assert.equal(element, root);
          assert.equal(JSON.parse(points).points.length, 3);
          mounts++;
          return {
            destroy() {
              destroyed++;
            },
          };
        },
      };
    },
  });
  assert.equal(attempts, 0);
  show();
  await tick();
  assert.equal(retry.hidden, false);
  assert.match(status.textContent ?? "", /加载失败/);
  retry.click();
  await tick();
  assert.equal(attempts, 2);
  assert.equal(mounts, 1);
  assert.equal(status.hidden, true);
  maps.destroy();
  maps.destroy();
  assert.equal(destroyed, 1);
  assert.equal(stopped, 1);
  retry.click();
  await tick();
  assert.equal(attempts, 2);
});
test("disposal cancels a pending map mount; a fresh controller can restore the page", async () => {
  const { document } = dom();
  let resolveLoad!: (module: {
      stylesheet: string;
      mountMapView: MapRuntime["mountMapView"];
    }) => void,
    mounts = 0;
  const load = new Promise<{
    stylesheet: string;
    mountMapView: MapRuntime["mountMapView"];
  }>((resolve) => {
    resolveLoad = resolve;
  });
  const maps = initMaps({
    root: document,
    observe: (_root, show) => {
      show();
      return () => {};
    },
    load: () => load,
  });
  maps.destroy();
  const module = {
    stylesheet: "/leaflet.css",
    mountMapView() {
      mounts++;
      return { destroy() {} };
    },
  };
  resolveLoad(module);
  await tick();
  assert.equal(mounts, 0);
  const restored = initMaps({
    root: document,
    observe: (_root, show) => {
      show();
      return () => {};
    },
    load: async () => module,
  });
  await tick();
  assert.equal(mounts, 1);
  restored.destroy();
});
test("malformed map payload fails before fetching the engine", async () => {
  const { document, root, retry } = dom();
  root.dataset.map = "invalid";
  let loads = 0;
  const maps = initMaps({
    root: document,
    observe: (_root, show) => {
      show();
      return () => {};
    },
    load: async () => {
      loads++;
      throw new Error();
    },
  });
  await tick();
  assert.equal(loads, 0);
  assert.equal(retry.hidden, false);
  maps.destroy();
});
test("map styles wait for visibility and load before mounting; failures retry and destruction removes the owned stylesheet", async () => {
  const f = dom();
  let show = () => {},
    mounts = 0;
  const maps = initMapsController({
    root: f.document,
    observe: (_root, callback) => {
      show = callback;
      return () => {};
    },
    load: async () => ({
      stylesheet: "/leaflet.css",
      mountMapView() {
        mounts++;
        return { destroy() {} };
      },
    }),
  });
  assert.equal(f.document.querySelector("link[rel=stylesheet]"), null);
  show();
  await tick();
  const first = f.document.querySelector<HTMLLinkElement>(
    "link[rel=stylesheet]",
  )!;
  assert.equal(first.getAttribute("href"), "/leaflet.css");
  assert.equal(mounts, 0);
  first.dispatchEvent(new f.window.Event("error"));
  await tick();
  assert.equal(f.retry.hidden, false);
  assert.equal(first.isConnected, false);
  f.retry.click();
  await tick();
  const second = f.document.querySelector<HTMLLinkElement>(
    "link[rel=stylesheet]",
  )!;
  second.dispatchEvent(new f.window.Event("load"));
  await tick();
  assert.equal(mounts, 1);
  assert.equal(f.status.hidden, true);
  assert.equal(second.isConnected, true);
  maps.destroy();
  assert.equal(second.isConnected, false);
});
test("disposing during stylesheet loading prevents a late map mount", async () => {
  const f = dom();
  let mounts = 0;
  const maps = initMapsController({
    root: f.document,
    observe: (_root, show) => {
      show();
      return () => {};
    },
    load: async () => ({
      stylesheet: "/leaflet.css",
      mountMapView() {
        mounts++;
        return { destroy() {} };
      },
    }),
  });
  await tick();
  const link = f.document.querySelector<HTMLLinkElement>(
    "link[rel=stylesheet]",
  )!;
  maps.destroy();
  link.dispatchEvent(new f.window.Event("load"));
  await tick();
  assert.equal(mounts, 0);
  assert.equal(link.isConnected, false);
});
test("an already canceled stylesheet request creates no link", async () => {
  const f = dom(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadMapStyles(f.document, "/leaflet.css", controller.signal),
    /canceled/,
  );
  assert.equal(f.document.querySelector("link[rel=stylesheet]"), null);
});
