import assert from "node:assert/strict";
import { test } from "node:test";
import { environment } from "./helpers/runtime-bundle";
import { emit, stackEnvironment } from "./helpers/stack-environment";

test("archive hover opens the whole stack, ignores touch hover, and leaves no hidden focusable back cards", () => {
  const s = stackEnvironment();
  assert.equal(s.count.disabled, false);
  assert.equal(s.open(), false);
  assert.equal(s.cards[1].inert, true);
  emit(s.group, "pointerenter", { pointerType: "touch" });
  assert.equal(s.open(), false);
  emit(s.group, "pointerenter", { pointerType: "mouse" });
  assert.equal(s.open(), true);
  assert.equal(s.count.getAttribute("aria-expanded"), "true");
  assert.ok(s.cards.every((c) => !c.inert));
  emit(s.group, "pointerleave", { pointerType: "mouse" });
  assert.equal(s.open(), false);
  assert.equal(s.cards[1].getAttribute("aria-hidden"), "true");
  assert.equal(s.cards[0].inert, false);
  const coarse = stackEnvironment({ canHover: false });
  emit(coarse.group, "pointerenter", { pointerType: "mouse" });
  assert.equal(coarse.open(), false);
});
test("archive keyboard focus survives pointer departure; Escape restores the count badge and focus exit closes", () => {
  const s = stackEnvironment();
  s.count.focus();
  assert.equal(s.open(), true);
  s.link.focus();
  emit(s.group, "pointerleave", { pointerType: "mouse" });
  assert.equal(s.open(), true);
  const escape = emit(s.group, "keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(s.open(), false);
  assert.equal(s.document.activeElement, s.count);
  s.link.focus();
  assert.equal(s.open(), true);
  s.document.activeElement = s.outside;
  emit(s.group, "focusout", { relatedTarget: s.outside });
  assert.equal(s.open(), false);
});
test("archive touch uses the count badge without stealing article links; outside taps and mouse departure close", () => {
  const s = stackEnvironment({ canHover: false });
  emit(s.document, "pointerdown", { target: s.count, pointerType: "touch" });
  s.count.focus();
  assert.equal(s.open(), false);
  s.count.click();
  assert.equal(s.open(), true);
  const click = emit(s.link, "click");
  assert.equal(click.defaultPrevented, false);
  s.count.click();
  assert.equal(s.open(), false);
  s.count.click();
  emit(s.document, "pointerdown", { target: s.outside, pointerType: "touch" });
  assert.equal(s.open(), false);
  const mouse = stackEnvironment();
  emit(mouse.group, "pointerenter", { pointerType: "mouse" });
  emit(mouse.document, "pointerdown", {
    target: mouse.count,
    pointerType: "mouse",
  });
  mouse.count.focus();
  mouse.count.click();
  emit(mouse.group, "pointerleave", { pointerType: "mouse" });
  assert.equal(mouse.open(), false);
});
test("archive old stack hashes still reveal; malformed hashes are safe and device changes dismiss", () => {
  const s = stackEnvironment({ hash: "#folder-fixture" });
  assert.equal(s.open(), true);
  assert.equal(s.group.scrolled, true);
  s.hover.matches = false;
  s.hover.dispatchEvent(new Event("change"));
  assert.equal(s.open(), false);
  s.location.hash = "#%";
  s.window.dispatchEvent(new Event("hashchange"));
  assert.equal(s.open(), false);
  s.location.hash = "#folder-fixture";
  s.window.dispatchEvent(new Event("hashchange"));
  assert.equal(s.open(), true);
  assert.doesNotThrow(() =>
    environment({ document: { querySelectorAll: () => [] } }).initStacks(),
  );
});
test("rapid archive hover interruptions return actual Motion transforms to CSS and restore focus before hiding", async () => {
  const s = stackEnvironment();
  for (let i = 0; i < 4; i++) {
    emit(s.group, "pointerenter", { pointerType: "mouse" });
    emit(s.group, "pointerleave", { pointerType: "mouse" });
  }
  s.cards.forEach((c) => c.animations.forEach((a) => a.finish()));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(s.cards.some((c) => c.animations.length));
  assert.ok(s.cards.every((c) => c.style.transform === ""));
  assert.equal(s.open(), false);
  emit(s.group, "pointerenter", { pointerType: "mouse" });
  emit(s.document, "pointerdown", { target: s.link, pointerType: "mouse" });
  s.link.focus();
  emit(s.group, "pointerleave", { pointerType: "mouse" });
  assert.equal(s.document.activeElement, s.count);
  assert.equal(s.open(), false);
});
