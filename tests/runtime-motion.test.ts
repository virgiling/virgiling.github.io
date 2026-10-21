import assert from "node:assert/strict";
import { test } from "node:test";
import { Element, environment } from "./helpers/runtime-bundle";

test("Motion completion returns stack transforms to CSS, including repeated expand/collapse", async () => {
  const { transition } = environment(),
    card = new Element();
  for (let cycle = 0; cycle < 3; cycle++) {
    const expand = transition(card, {
      transform: ["translate(7px,32px) scale(.982)", "none"],
    });
    card.animations.at(-1)!.finish();
    await expand;
    assert.equal(
      card.style.transform,
      "",
      "inline transform must not override closed-stack CSS",
    );
    const collapse = transition(card, {
      transform: ["none", "matrix(.982,0,0,.982,7,32)"],
    });
    card.animations.at(-1)!.finish();
    await collapse;
    assert.equal(
      card.style.transform,
      "",
      "closed offsets must remain responsive CSS, not a frozen matrix",
    );
  }
});
test("completion preserves intended inline TOC target, CSS priority and unrelated styles", async () => {
  const { transition } = environment(),
    marker = new Element();
  marker.style.setProperty("transform", "translateY(42px)", "important");
  marker.style.setProperty("--i", "2");
  const done = transition(marker, {
    transform: ["translateY(0px)", "translateY(42px)"],
    opacity: [0, 1],
  });
  marker.style.height = "31px";
  marker.animations.forEach((a) => a.finish());
  await done;
  assert.equal(marker.style.transform, "translateY(42px)");
  assert.equal(marker.style.getPropertyPriority("transform"), "important");
  assert.equal(marker.style.opacity, "");
  assert.equal(marker.style.height, "31px");
  assert.equal(marker.style.getPropertyValue("--i"), "2");
});
test("rapid interruption and explicit stop settle callers without stale inline styles", async () => {
  const { transition, stop } = environment(),
    card = new Element();
  const first = transition(card, { transform: ["none", "translateY(32px)"] });
  const second = transition(card, { transform: ["translateY(32px)", "none"] });
  assert.equal(await first, false);
  assert.equal(card.animations[0].playState, "idle");
  card.animations[1].finish();
  assert.equal(await second, true);
  assert.equal(card.style.transform, "");
  const third = transition(card, { opacity: [0, 1] });
  stop(card);
  assert.equal(await third, false);
  assert.equal(card.style.opacity, "");
});
test("reduced motion cancels and restores in-flight effects; subsequent transitions create no animation", async () => {
  const { transition, media } = environment(),
    card = new Element();
  const done = transition(card, { transform: ["none", "translateY(32px)"] });
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  assert.equal(await done, false);
  assert.equal(card.style.transform, "");
  assert.equal(card.animations[0].playState, "idle");
  assert.equal(await transition(card, { opacity: [0, 1] }), true);
  assert.equal(card.animations.length, 1);
});
