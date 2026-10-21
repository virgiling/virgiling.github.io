import { test } from "node:test";
import assert from "node:assert/strict";
import { data, tick } from "./helpers/map-runtime";
import { viewFixture } from "./helpers/map-view-fixture";
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
