import assert from "node:assert/strict";
import { Element, environment } from "./runtime-bundle";

export function cardMotionEnvironment({ hover = true, reduce = false, control = false } = {}) {
  const classes = new Set<string>(),
    child = {},
    sibling = {};
  const card = Object.assign(new Element(), {
    contains: (node: unknown) => node === child || node === sibling,
    matches: () => false,
    classList: {
      toggle: (key: string, on: boolean) =>
        on ? classes.add(key) : classes.delete(key),
      remove: (key: string) => classes.delete(key),
    },
  });
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    activeElement: null as unknown,
    querySelectorAll: (selector: string) => {
      assert.equal(selector, "[data-card-motion]:not(.stack-card), [data-control-motion]");
      return [card];
    },
  });
  const hoverable = Object.assign(new EventTarget(), { matches: hover });
  const preference = Object.assign(new EventTarget(), { matches: reduce });
  const api = environment({
    document: doc,
    matchMedia: (query: string) =>
      query.includes("any-hover") ? hoverable : preference,
    getComputedStyle: () => ({
      transform:
        card.style.transform ||
        (classes.has("is-card-emphasized") ? (control ? "translateY(-2px)" : "scale(1.01)") : "none"),
    }),
  });
  const controller = api.initCardMotion();
  const emit = (type: string, values: Record<string, unknown> = {}) =>
    card.dispatchEvent(Object.assign(new Event(type), values));
  return {
    api,
    card,
    child,
    sibling,
    classes,
    doc,
    hoverable,
    preference,
    controller,
    emit,
  };
}
