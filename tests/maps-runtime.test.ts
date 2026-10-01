// Node DOM/controller tests with Leaflet and Motion boundaries, not browser acceptance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { initMaps as initMapsController } from "../src/runtime/maps";
import { loadMapStyles } from "../src/runtime/map-styles";
const initMaps: typeof initMapsController = (options) =>
  initMapsController({ styles: async () => {}, ...options });
import { popupAnchor } from "../src/maps/focus";
import { rect } from "./helpers/dom";
import type { MapData, Coordinates } from "../src/maps/types";
type MapRuntime = typeof import("../src/runtime/map-view");
const data: MapData = {
  name: "Test",
  points: [
    {
      id: "a.md",
      title: "<img src=x onerror=alert(1)>",
      url: "/a",
      coordinates: [0, 0],
      icon: "constructor",
      color: "#123456",
    },
    {
      id: "b.md",
      title: "Second",
      url: "/b",
      coordinates: [0, 0],
      icon: "plane",
      color: "red",
    },
    {
      id: "c.md",
      title: "Third",
      url: "/c",
      coordinates: [11, 22],
      icon: "map-pin",
      color: "blue",
    },
  ],
  minZoom: 0,
  maxZoom: 18,
  height: 400,
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  attribution: "<img src=x onerror=alert(1)>",
};
function dom() {
  const { document, window } = parseHTML(
    `<html><head></head><body><section data-map><astro-leaflet data-defer data-id="map" data-options='{"center":[0,0],"zoom":2}'><div id="map"></div></astro-leaflet><p class="map-status"></p><button class="map-retry" hidden>Retry</button></section></body></html>`,
  );
  const root = document.querySelector<HTMLElement>("[data-map]")!;
  root.dataset.map = JSON.stringify(data);
  return {
    document,
    window,
    root,
    retry: root.querySelector<HTMLButtonElement>(".map-retry")!,
    status: root.querySelector<HTMLElement>(".map-status")!,
  };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
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
const viewBundle = await build({
  entryPoints: [
    fileURLToPath(new URL("../src/runtime/map-view.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "MapRuntime",
  platform: "browser",
  external: ["astro-leaflet/leaflet"],
  plugins: [
    {
      name: "map-boundaries",
      setup(builder) {
        builder.onResolve({ filter: /^astro-leaflet\/hydrate$/ }, () => ({
          path: "register",
          namespace: "fixture",
        }));

        builder.onResolve({ filter: /^\.\/motion-value$/ }, () => ({
          path: "test-motion-value",
          external: true,
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'export const stylesheet = "/leaflet.css";',
        }));
      },
    },
  ],
});
interface CameraAnimation {
  update(progress: number): void;
  duration: number;
  stopped: boolean;
}
interface PopupDouble {
  options: { maxWidth?: number; maxHeight?: number };
  getElement(): HTMLElement;
  getLatLng(): Coordinates;
  update(): void;
}
function viewFixture({
  failInvalidate = false,
  animated = false,
  retina = false,
} = {}) {
  const fixture = dom();
  let removed = 0,
    zoom = 3,
    center: Coordinates = [10, 20];
  const viewport = fixture.document.querySelector<HTMLElement>("#map")!;
  viewport.getBoundingClientRect = () => rect(10, 20, 400, 480);
  const events = new Map<string, (event: Record<string, unknown>) => void>();
  const views: Array<{
      coordinates: Coordinates;
      zoom: number;
      options: unknown;
    }> = [],
    fits: unknown[] = [];
  const zooms: Array<{
    anchor: unknown;
    zoom: number;
    options: { animate?: boolean };
  }> = [];
  const pans: Array<{
      offset: [number, number];
      options: { animate?: boolean };
    }> = [],
    animations: CameraAnimation[] = [];
  const map = {
    on(handlers: Record<string, (event: Record<string, unknown>) => void>) {
      for (const [name, callback] of Object.entries(handlers))
        events.set(name, callback);
    },
    off(handlers: Record<string, unknown>) {
      for (const name of Object.keys(handlers)) events.delete(name);
    },
    fire(name: string, event: Record<string, unknown> = {}) {
      events.get(name)?.(event);
    },
    panBy(offset: [number, number], options: { animate?: boolean } = {}) {
      pans.push({ offset, options });
      return this;
    },
    panTo(coordinates: Coordinates, options: unknown) {
      center = coordinates;
      views.push({ coordinates, zoom, options });
      return this;
    },
    setView(coordinates: Coordinates, level: number, options: unknown) {
      zoom = level;
      center = coordinates;
      views.push({ coordinates, zoom, options });
      return this;
    },
    fitBounds(bounds: unknown, options: unknown) {
      fits.push({ bounds, options });
      return this;
    },
    getZoom: () => zoom,
    getMinZoom: () => data.minZoom,
    getMaxZoom: () => data.maxZoom,
    getScaleZoom: (scale: number, level: number) => level + Math.log2(scale),
    mouseEventToContainerPoint: (event: MouseEvent) => ({
      x: event.clientX - 10,
      y: event.clientY - 20,
    }),
    setZoomAround(
      anchor: unknown,
      level: number,
      options: { animate?: boolean },
    ) {
      this.fire("zoomstart");
      zoom = level;
      zooms.push({ anchor, zoom, options });
      this.fire("zoomend");
      return this;
    },
    getCenter: () => center,
    getContainer: () => viewport,
    getSize: () => ({ x: 400, y: 480 }),
    project: (coordinates: Coordinates) => ({
      x: coordinates[1] * 10,
      y: coordinates[0] * 10,
    }),
    unproject: (point: [number, number]): Coordinates => [
      point[1] / 10,
      point[0] / 10,
    ],
    latLngToContainerPoint(coordinates: Coordinates) {
      return {
        x: 200 + (coordinates[1] - center[1]) * 10,
        y: 240 + (coordinates[0] - center[0]) * 10,
      };
    },
    invalidateSize() {
      if (failInvalidate) throw new Error("size failure");
    },
    remove() {
      removed++;
    },
  };
  const layers: Array<{
    events: Map<string, () => void>;
    options: {
      attribution: string;
      detectRetina: boolean;
      maxZoom: number;
      maxNativeZoom?: number;
    };
  }> = [];
  const points: Array<{
    coordinates: Coordinates;
    options: Record<string, unknown>;
    popup?: HTMLElement;
    popupHandle?: PopupDouble;
    opened: number;
    open(): void;
    close(): void;
  }> = [];
  const leaflet = {
    Browser: { retina },
    tileLayer(_url: string, options: (typeof layers)[number]["options"]) {
      const layer = { events: new Map<string, () => void>(), options };
      layers.push(layer);
      return {
        on(name: string, callback: () => void) {
          layer.events.set(name, callback);
        },
        off(name: string) {
          layer.events.delete(name);
        },
        addTo() {},
      };
    },
    divIcon: (options: Record<string, unknown>) => options,
    latLngBounds: (coordinates: Coordinates[]) => ({
      coordinates,
      getCenter: () => coordinates[0],
    }),
    marker(coordinates: Coordinates, options: Record<string, unknown>) {
      let popup: PopupDouble | undefined;
      const point = {
        coordinates,
        options,
        popup: undefined as HTMLElement | undefined,
        popupHandle: undefined as PopupDouble | undefined,
        opened: 0,
        open() {
          point.opened++;
          map.fire("popupopen", { popup });
        },
        close() {
          map.fire("popupclose", { popup });
        },
      };
      points.push(point);
      const marker = {
        addTo() {
          return marker;
        },
        bindPopup(node: HTMLElement) {
          point.popup = node;
          popup = {
            options: {},
            getLatLng: () => coordinates,
            getElement: () => node,
            update() {},
          };
          point.popupHandle = popup;
          node.getBoundingClientRect = () => {
            const anchor = map.latLngToContainerPoint(coordinates),
              width = Math.min(260, popup!.options.maxWidth ?? 260) + 26,
              height = Math.min(180, popup!.options.maxHeight ?? 180) + 26;
            return rect(
              10 + anchor.x - width / 2,
              20 + anchor.y - height + 7,
              width,
              height,
            );
          };
          return marker;
        },
      };
      return marker;
    },
  };
  const host = fixture.root.querySelector<HTMLElement>("astro-leaflet")!;
  Object.assign(host, {
    leafletElement: undefined,
    activate() {
      Object.assign(host, { leafletElement: map });
    },
    disconnectedCallback() {
      if (Reflect.get(host, "leafletElement")) map.remove();
      Object.assign(host, { leafletElement: undefined });
    },
  });
  const context = {
    document: fixture.document,
    URL,
    MapRuntime: {} as MapRuntime,
    require: (name: string) => {
      if (name === "astro-leaflet/leaflet") return leaflet;
      assert.equal(name, "test-motion-value");
      return {
        transitionValue(update: (progress: number) => void, duration: number) {
          const animation: CameraAnimation = {
            update,
            duration,
            stopped: false,
          };
          animations.push(animation);
          if (!animated || duration === 0) update(1);
          else update(0);
          return {
            stop() {
              animation.stopped = true;
            },
          };
        },
      };
    },
  };
  runInNewContext(viewBundle.outputFiles[0].text, context);
  return {
    ...fixture,
    runtime: context.MapRuntime,
    layers,
    points,
    views,
    fits,
    pans,
    zooms,
    map,
    events,
    animations,
    removed: () => removed,
  };
}
test("coincident markers keep all safe links and focus a fully visible popup without a separate list", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, data);
  assert.equal(fixture.points.length, 2);
  assert.equal(fixture.fits.length, 1);
  const popup = fixture.points[0].popup!;
  assert.equal(popup.querySelectorAll("a").length, 2);
  assert.equal(popup.querySelector("a")?.textContent, data.points[0].title);
  assert.equal(popup.querySelector("a")?.getAttribute("href"), "/a");
  assert.equal(popup.querySelector("img"), null);
  const icon = fixture.points[0].options.icon as { html: HTMLElement };
  assert.ok(icon.html.querySelector("svg"));
  assert.equal(icon.html.querySelector(".map-marker-count")?.textContent, "2");
  assert.ok(!fixture.layers[0].options.attribution.includes("<img"));
  assert.ok(
    fixture.layers[0].options.attribution.includes(
      'href="https://www.openstreetmap.org/copyright"',
    ),
  );
  fixture.map.panBy([80, 0], { animate: true });
  assert.equal(fixture.pans[0].options.animate, false);
  fixture.points[0].open();
  assert.deepEqual(Array.from(fixture.map.getCenter()), [0, 0]);
  assert.equal(
    (fixture.views[0].options as { animate: boolean }).animate,
    false,
  );
  const box = popup.getBoundingClientRect();
  assert.ok(
    box.top >= 36 && box.left >= 26 && box.bottom <= 484 && box.right <= 394,
  );
  fixture.layers[0].events.get("tileerror")!();
  assert.match(fixture.status.textContent ?? "", /地点仍可浏览/);
  view.destroy();
  assert.equal(fixture.removed(), 1);
  assert.equal(fixture.layers[0].events.size, 0);
  assert.equal(fixture.events.size, 0);
});
function input(
  fixture: ReturnType<typeof viewFixture>,
  type: string,
  values: Record<string, unknown> = {},
  target: HTMLElement | Document = fixture.map.getContainer(),
) {
  const event = Object.assign(
    new fixture.window.Event(type, { bubbles: true, cancelable: true }),
    values,
  );
  target.dispatchEvent(event);
  return event;
}
const wheelValues = {
  ctrlKey: true,
  deltaY: -25,
  deltaMode: 0,
  clientX: 110,
  clientY: 120,
};
test("trackpad pinch is consumed by the map instead of zooming the page", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, data);
  const before = fixture.map.getZoom();
  const pinch = input(fixture, "wheel", wheelValues);
  assert.equal(
    pinch.defaultPrevented,
    true,
    "pinch must not fall through to browser page zoom",
  );
  assert.equal(fixture.map.getZoom(), before + 0.25);
  assert.deepEqual(
    { ...(fixture.zooms[0].anchor as { x: number; y: number }) },
    { x: 100, y: 100 },
  );
  assert.equal(fixture.zooms[0].options.animate, false);
  input(fixture, "wheel", { ...wheelValues, deltaY: 50 });
  assert.equal(fixture.map.getZoom(), before - 0.25);
  view.destroy();
});
test("ordinary scrolling and page pinch outside the map remain native; capture pinch with a non-passive map listener", () => {
  const fixture = viewFixture();
  const registrations: AddEventListenerOptions[] = [];
  const container = fixture.map.getContainer(),
    add = container.addEventListener.bind(container);
  container.addEventListener = (type, listener, options) => {
    if (type === "wheel" && typeof options === "object")
      registrations.push(options);
    add(type, listener, options);
  };
  const view = fixture.runtime.mountMapView(fixture.root, data),
    before = fixture.map.getZoom();
  assert.ok(
    registrations.some(
      (options) => options.capture === true && options.passive === false,
    ),
  );
  for (const values of [
    { ...wheelValues, ctrlKey: false },
    { ...wheelValues, deltaY: 0, deltaX: 50 },
    { ...wheelValues, deltaY: NaN },
  ]) {
    assert.equal(input(fixture, "wheel", values).defaultPrevented, false);
    assert.equal(fixture.map.getZoom(), before);
  }
  assert.equal(
    input(fixture, "wheel", wheelValues, fixture.document).defaultPrevented,
    false,
  );
  assert.equal(fixture.map.getZoom(), before);
  view.destroy();
});
test("pinch normalizes wheel units, clamps zoom bounds, and still prevents page zoom at the limits", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, data);
  input(fixture, "wheel", { ...wheelValues, deltaY: -1, deltaMode: 1 });
  assert.equal(fixture.map.getZoom(), 3.16);
  input(fixture, "wheel", { ...wheelValues, deltaY: -100000 });
  assert.equal(fixture.map.getZoom(), data.maxZoom);
  const count = fixture.zooms.length;
  assert.equal(input(fixture, "wheel", wheelValues).defaultPrevented, true);
  assert.equal(fixture.zooms.length, count);
  input(fixture, "wheel", { ...wheelValues, deltaY: 100000 });
  assert.equal(fixture.map.getZoom(), data.minZoom);
  input(fixture, "wheel", { ...wheelValues, deltaY: -1, deltaMode: 2 });
  assert.equal(fixture.map.getZoom(), 4.8);
  view.destroy();
});
test("WebKit trackpad gestures use absolute scale without applying duplicate ctrl-wheel deltas", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, data);
  assert.equal(
    input(fixture, "gesturestart", { scale: 1 }).defaultPrevented,
    true,
  );
  assert.equal(
    input(fixture, "gesturechange", { scale: 1.25 }).defaultPrevented,
    true,
  );
  assert.equal(fixture.map.getZoom(), 3 + Math.log2(1.25));
  assert.equal(input(fixture, "wheel", wheelValues).defaultPrevented, true);
  assert.equal(fixture.zooms.length, 1);
  input(fixture, "gesturechange", { scale: 2 });
  assert.equal(fixture.map.getZoom(), 4);
  assert.deepEqual(Array.from(fixture.zooms[0].anchor as number[]), [200, 240]);
  for (const scale of [0, NaN, Infinity, "2"])
    input(fixture, "gesturechange", { scale });
  assert.equal(fixture.map.getZoom(), 4);
  input(fixture, "gestureend");
  input(fixture, "wheel", wheelValues);
  assert.equal(fixture.map.getZoom(), 4.25);
  view.destroy();
});
test("physical touch remains with Leaflet, while overlapping browser gesture events cannot zoom the page or double-apply scale", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, data);
  assert.equal(
    input(fixture, "touchstart", { touches: [{}, {}] }).defaultPrevented,
    false,
  );
  assert.equal(
    input(fixture, "gesturestart", { scale: 1 }).defaultPrevented,
    true,
  );
  assert.equal(
    input(fixture, "gesturechange", { scale: 2 }).defaultPrevented,
    true,
  );
  input(fixture, "wheel", wheelValues);
  assert.equal(fixture.zooms.length, 0);
  input(fixture, "touchend", { touches: [{}] }, fixture.document);
  input(fixture, "gesturechange", { scale: 2 });
  assert.equal(fixture.zooms.length, 0);
  input(fixture, "touchcancel", { touches: [] }, fixture.document);
  input(fixture, "gesturestart", { scale: 1 });
  input(fixture, "gesturechange", { scale: 2 });
  assert.equal(fixture.map.getZoom(), 4);
  view.destroy();
});
test("pinch interrupts popup focus and releases all input handling on disposal or a partial mount failure", () => {
  const fixture = viewFixture({ animated: true }),
    view = fixture.runtime.mountMapView(fixture.root, data);
  fixture.points[0].open();
  input(fixture, "wheel", wheelValues);
  assert.equal(fixture.animations[0].stopped, true);
  const before = fixture.map.getZoom();
  input(fixture, "gesturestart", { scale: 1 });
  fixture.document.dispatchEvent(new fixture.window.Event("visibilitychange"));
  input(fixture, "gesturechange", { scale: 2 });
  assert.equal(fixture.map.getZoom(), before);
  view.destroy();
  assert.equal(input(fixture, "wheel", wheelValues).defaultPrevented, false);
  assert.equal(
    input(fixture, "gesturestart", { scale: 1 }).defaultPrevented,
    false,
  );
  assert.equal(fixture.map.getZoom(), before);
  const partial = viewFixture({ failInvalidate: true });
  assert.throws(
    () => partial.runtime.mountMapView(partial.root, data),
    /size failure/,
  );
  assert.equal(input(partial, "wheel", wheelValues).defaultPrevented, false);
});
test("retina raster tiles preserve the map's maximum zoom and cap OSM requests at zoom 19", () => {
  for (const retina of [false, true]) {
    const fixture = viewFixture({ retina }),
      view = fixture.runtime.mountMapView(fixture.root, data);
    const options = fixture.layers[0].options;
    assert.equal(options.detectRetina, true);
    assert.equal(options.maxZoom - (retina ? 1 : 0), data.maxZoom);
    assert.equal(options.maxNativeZoom! + (retina ? 1 : 0), 19);
    view.destroy();
  }
  const fixture = viewFixture({ retina: true }),
    view = fixture.runtime.mountMapView(fixture.root, {
      ...data,
      tiles: ["https://tiles.example/{z}/{x}/{y}{r}.png"],
    });
  assert.equal(fixture.layers[0].options.detectRetina, false);
  assert.equal(fixture.layers[0].options.maxZoom, data.maxZoom);
  view.destroy();
});
test("Motion progresses from current center to target and is interrupted by another popup, drag or destruction", async () => {
  const fixture = viewFixture({ animated: true }),
    view = fixture.runtime.mountMapView(fixture.root, data);
  await tick();
  fixture.points[0].open();
  const first = fixture.animations[0];
  assert.deepEqual(Array.from(fixture.map.getCenter()), [10, 20]);
  first.update(0.5);
  assert.deepEqual(Array.from(fixture.map.getCenter()), [5, 10]);
  first.update(1);
  assert.deepEqual(Array.from(fixture.map.getCenter()), [0, 0]);
  fixture.points[1].open();
  assert.equal(first.stopped, true);
  fixture.map.fire("dragstart");
  assert.equal(fixture.animations[1].stopped, true);
  fixture.points[0].open();
  view.destroy();
  assert.equal(fixture.animations[2].stopped, true);
  const center = fixture.map.getCenter();
  fixture.animations[2].update(1);
  assert.equal(fixture.map.getCenter(), center);
});
test("popup close cancels focus and resize repairs visibility without recentering or adding a timed transition", async () => {
  const fixture = viewFixture({ animated: true }),
    view = fixture.runtime.mountMapView(fixture.root, data);
  await tick();
  fixture.points[0].open();
  fixture.points[0].close();
  assert.equal(fixture.animations[0].stopped, true);
  fixture.points[0].open();
  fixture.animations[1].update(1);
  fixture.map.fire("resize");
  assert.equal(fixture.animations[2].duration, 0);
  assert.deepEqual(Array.from(fixture.map.getCenter()), [0, 0]);
  view.destroy();
});
test("invalid projected source is rejected before activating the map instance", () => {
  const fixture = viewFixture();
  assert.throws(() =>
    fixture.runtime.mountMapView(
      fixture.root,
      JSON.stringify({
        ...data,
        points: [{ ...data.points[0], url: "//invalid.example" }],
      }),
    ),
  );
  assert.equal(fixture.views.length, 0);
  assert.equal(fixture.layers.length, 0);
  assert.equal(fixture.removed(), 0);
});
test("popup geometry centers ordinary popups and minimally corrects tall or off-edge ones", () => {
  assert.deepEqual(
    popupAnchor(
      { x: 400, y: 480 },
      { left: -100, top: -150, right: 100, bottom: 7 },
    ),
    { x: 200, y: 240 },
  );
  assert.deepEqual(
    popupAnchor(
      { x: 400, y: 480 },
      { left: -100, top: -300, right: 100, bottom: 7 },
    ),
    { x: 200, y: 316 },
  );
  assert.deepEqual(
    popupAnchor(
      { x: 400, y: 480 },
      { left: -100, top: -150, right: 100, bottom: 7 },
      { x: 20, y: 10 },
    ),
    { x: 116, y: 166 },
  );
});
test("explicit center and zoom are not replaced by automatic bounds", () => {
  const fixture = viewFixture(),
    view = fixture.runtime.mountMapView(fixture.root, {
      ...data,
      center: [0, 0],
      zoom: 4,
    });
  assert.equal(fixture.fits.length, 0);
  assert.deepEqual(Array.from(fixture.views[0].coordinates), [0, 0]);
  assert.equal(fixture.views[0].zoom, 4);
  view.destroy();
});
test("partial map mount failure removes its instance, tile callbacks and focus listeners", () => {
  const fixture = viewFixture({ failInvalidate: true });
  assert.throws(
    () => fixture.runtime.mountMapView(fixture.root, data),
    /size failure/,
  );
  assert.equal(fixture.removed(), 1);
  assert.equal(fixture.layers[0].events.size, 0);
  assert.equal(fixture.events.size, 0);
});
test("patched astro-leaflet defers construction, destroys once, and can reactivate", async () => {
  const sourcePath = fileURLToPath(
    new URL(
      "../node_modules/astro-leaflet/src/components/hydrate.ts",
      import.meta.url,
    ),
  );
  const source = await readFile(sourcePath, "utf8");
  const names = [
    ...source.matchAll(/import \{([^}]+)\} from '\.\/customElements\//g),
  ].flatMap((match) => match[1].split(",").map((name) => name.trim()));
  const bundle = await build({
    entryPoints: [sourcePath],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    external: ["leaflet"],
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "fake-child-elements",
        setup(builder) {
          builder.onResolve({ filter: /^\.\/customElements\// }, () => ({
            path: "children",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: names
              .map((name) => `export class ${name} extends HTMLElement {}`)
              .join("\n"),
          }));
        },
      },
    ],
  });
  const { document, window } = dom();
  let created = 0,
    removed = 0;
  runInNewContext(bundle.outputFiles[0].text, {
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
    require: (name: string) => {
      if (name === "leaflet/dist/leaflet.css?url") return "/leaflet.css";
      assert.equal(name, "leaflet");
      return {
        map() {
          created++;
          return {
            setView() {},
            remove() {
              removed++;
            },
          };
        },
        tileLayer() {
          return { addTo() {} };
        },
      };
    },
  });
  const host = document.querySelector("astro-leaflet") as HTMLElement & {
    activate(): void;
    disconnectedCallback(): void;
    leafletElement?: unknown;
  };
  assert.equal(created, 0);
  host.activate();
  host.activate();
  assert.equal(created, 1);
  host.disconnectedCallback();
  host.disconnectedCallback();
  assert.equal(removed, 1);
  assert.equal(host.leafletElement, undefined);
  host.activate();
  assert.equal(created, 2);
  host.remove();
  assert.equal(removed, 2);
});
