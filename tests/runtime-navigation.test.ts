import assert from "node:assert/strict";
import { test } from "node:test";
import { Element, environment } from "./helpers/runtime-bundle";

test("native page arrivals, history restoration and hash navigation get cancellable Motion feedback", async () => {
  const win = Object.assign(new EventTarget(), {
    location: { hash: "" },
    performance: { getEntriesByType: () => [{ type: "navigate" }] },
  });
  const main = new Element(),
    heading = new Element();
  const doc = {
    readyState: "loading",
    querySelector: () => main,
    getElementById: (id: string) => (id === "section" ? heading : null),
  };
  const runtime = environment(),
    control = runtime.initNavigationMotion({ win, doc });
  win.dispatchEvent(new Event("pageshow"));
  assert.equal(main.animations.length, 2);
  assert.ok(main.animations.some((animation) => animation.keyframes.transform));
  win.dispatchEvent(new Event("pageshow"));
  assert.equal(main.animations.length, 2, "no double entry");
  win.dispatchEvent(new Event("pagehide"));
  assert.ok(
    main.animations.every((animation) => animation.playState === "idle"),
  );
  assert.equal(main.style.transform, "");
  win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assert.equal(main.animations.length, 3);
  assert.equal(
    main.animations[2].keyframes.transform,
    undefined,
    "history feedback must not move the restored viewport",
  );
  win.location.hash = "#section";
  win.dispatchEvent(new Event("hashchange"));
  assert.equal(heading.animations.length, 1);
  assert.ok(heading.animations[0].keyframes.backgroundColor);
  runtime.media.matches = true;
  runtime.media.dispatchEvent(new Event("change"));
  assert.equal(main.animations[2].playState, "idle");
  assert.equal(heading.animations[0].playState, "idle");
  win.dispatchEvent(new Event("hashchange"));
  assert.equal(
    heading.animations.length,
    1,
    "reduced motion creates no new animation",
  );
  win.location.hash = "#%broken";
  assert.doesNotThrow(() => win.dispatchEvent(new Event("hashchange")));
  control.destroy();
  runtime.media.matches = false;
  win.dispatchEvent(new Event("pageshow"));
  assert.equal(main.animations.length, 3);
});
test("late-loaded navigation enhancement supports ordinary non-BFCache back/forward entries", () => {
  const win = Object.assign(new EventTarget(), {
    location: { hash: "" },
    performance: { getEntriesByType: () => [{ type: "back_forward" }] },
  });
  const main = new Element(),
    runtime = environment();
  const control = runtime.initNavigationMotion({
    win,
    doc: {
      readyState: "complete",
      querySelector: () => main,
      getElementById: () => null,
    },
  });
  assert.equal(main.animations.length, 1);
  assert.equal(main.animations[0].keyframes.transform, undefined);
  control.destroy();
  assert.equal(main.animations[0].playState, "idle");
});
