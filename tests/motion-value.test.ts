import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
type ValueBoundary = Pick<
  typeof import("../src/runtime/motion-value"),
  "transitionValue"
>;
const bundle = await build({
  entryPoints: [
    fileURLToPath(new URL("../src/runtime/motion-value.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "ValueMotion",
  platform: "browser",
  external: ["motion", "motion/mini"],
});
function fixture(matches = false) {
  const reduced = Object.assign(new EventTarget(), { matches });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const callbacks = new Set<() => void>(),
    values: number[] = [];
  let now = 0;
  const context = {
    ValueMotion: {} as ValueBoundary,
    matchMedia: () => reduced,
    performance: { now: () => now },
    require: (name: string) => {
      if (name === "motion/mini")
        return {
          animate() {
            throw new Error("DOM animation is outside this fixture");
          },
        };
      assert.equal(name, "motion");
      return {
        frame: {
          update(callback: () => void) {
            callbacks.add(callback);
          },
        },
        cancelFrame(callback: () => void) {
          callbacks.delete(callback);
        },
      };
    },
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  return {
    reduced,
    doc,
    callbacks,
    values,
    motion: context.ValueMotion,
    tick(ms: number) {
      now = ms;
      for (const callback of [...callbacks]) callback();
    },
  };
}
test("shared numeric Motion uses its frame clock, eases progress and cleans up on completion", () => {
  const f = fixture();
  f.motion.transitionValue((value) => f.values.push(value), 0.28, f.doc);
  f.tick(70);
  f.tick(210);
  f.tick(280);
  assert.deepEqual(f.values, [0.578125, 0.984375, 1]);
  assert.equal(f.callbacks.size, 0);
  f.reduced.matches = true;
  f.reduced.dispatchEvent(new Event("change"));
  assert.equal(f.values.length, 3);
});
test("cancellation rejects further clock ticks without jumping to the target", () => {
  const f = fixture();
  const animation = f.motion.transitionValue(
    (value) => f.values.push(value),
    0.28,
    f.doc,
  );
  f.tick(70);
  animation.stop();
  animation.stop();
  f.tick(280);
  assert.deepEqual(f.values, [0.578125]);
  assert.equal(f.callbacks.size, 0);
});
test("runtime reduced motion and background visibility settle immediately and release their clock", () => {
  for (const mode of ["reduced", "hidden"] as const) {
    const f = fixture();
    f.motion.transitionValue((value) => f.values.push(value), 0.28, f.doc);
    f.tick(70);
    if (mode === "reduced") {
      f.reduced.matches = true;
      f.reduced.dispatchEvent(new Event("change"));
    } else {
      f.doc.hidden = true;
      f.doc.dispatchEvent(new Event("visibilitychange"));
    }
    assert.deepEqual(f.values, [0.578125, 1]);
    assert.equal(f.callbacks.size, 0);
    f.tick(280);
    assert.equal(f.values.length, 2);
  }
});
test("stale Motion callbacks cannot update a canceled transition", () => {
  const f = fixture();
  const animation = f.motion.transitionValue(
    (value) => f.values.push(value),
    0.28,
    f.doc,
  );
  const late = [...f.callbacks][0];
  animation.stop();
  late();
  assert.deepEqual(f.values, []);
});
test("initial reduced motion or immediate correction does not register a Motion frame callback", () => {
  for (const [matches, duration] of [
    [true, 0.28],
    [false, 0],
  ] as const) {
    const f = fixture(matches);
    const animation = f.motion.transitionValue(
      (value) => f.values.push(value),
      duration,
      f.doc,
    );
    assert.deepEqual(f.values, [1]);
    assert.equal(f.callbacks.size, 0);
    animation.stop();
  }
});
