import assert from "node:assert/strict";
import { test } from "node:test";
import { Element, environment } from "./helpers/runtime-bundle";

test("navigation uses transform geometry; press feedback releases correctly without retained inline transforms", async () => {
  const button = new Element(),
    classes = new Set<string>();
  button.classList = {
    contains: (key) => classes.has(key),
    toggle: (key, on) => (on ? classes.add(key) : classes.delete(key)),
  };
  const document = {
    querySelector: () => null,
    querySelectorAll: (s: string) =>
      s === ".folder-heading-link" ? [] : [button],
  };
  const runtime = environment({
    document,
    getComputedStyle: (e: Element) => ({
      transform:
        e.style.transform ||
        (classes.has("motion-pressed") ? "scale(.96)" : "none"),
    }),
  });
  assert.equal(
    runtime.navMarkerTransform({ left: 216, width: 80 }, { left: 100 }),
    "translateX(136px) scaleX(40)",
  );
  runtime.initInteractionMotion();
  button.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0 }));
  assert.ok(classes.has("motion-pressed"));
  button.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(button.style.transform, "");
  button.dispatchEvent(new Event("pointercancel"));
  assert.ok(!classes.has("motion-pressed"));
  button.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(button.style.transform, "");
});
test("MoC arrow uses Motion for hover/focus, cancels cleanly and respects reduced motion", async () => {
  const link = Object.assign(new Element(), { contains: () => false }),
    arrow = new Element(),
    classes = new Set<string>();
  link.querySelector = () => arrow;
  link.classList = {
    toggle: (k, on) => (on ? classes.add(k) : classes.delete(k)),
  };
  const document = {
    querySelector: () => null,
    querySelectorAll: (s: string) =>
      s === ".folder-heading-link" ? [link] : [],
  };
  const r = environment({
    document,
    getComputedStyle: () => ({
      transform:
        arrow.style.transform ||
        (classes.has("is-emphasized") ? "translateX(3px)" : "none"),
    }),
  });
  r.initInteractionMotion();
  link.dispatchEvent(new Event("pointerenter"));
  assert.equal(arrow.animations.length, 1);
  link.dispatchEvent(new Event("focusin"));
  link.dispatchEvent(new Event("pointerleave"));
  assert.ok(classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 1);
  link.dispatchEvent(new Event("focusout"));
  assert.ok(!classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 2);
  assert.equal(arrow.animations[0].playState, "idle");
  r.media.matches = true;
  r.media.dispatchEvent(new Event("change"));
  assert.equal(arrow.animations[1].playState, "idle");
  assert.equal(arrow.style.transform, "");
  link.dispatchEvent(new Event("focusin"));
  assert.ok(classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 2);
});
