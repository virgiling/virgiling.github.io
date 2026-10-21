import { test } from "node:test";
import assert from "node:assert/strict";
import { data } from "./helpers/map-runtime";
import { input, viewFixture, wheelValues } from "./helpers/map-view-fixture";
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
