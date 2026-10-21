import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { popupAnchor } from "../src/maps/focus";
import { data, dom } from "./helpers/map-runtime";
import { viewFixture } from "./helpers/map-view-fixture";
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
