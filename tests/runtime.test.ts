// Node-only controller tests. Fake DOM/WAAPI boundaries, no browser or visual model.
import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { rect } from "./helpers/dom";
import type { GraphAssets } from "../src/runtime/graph-assets";
type Motion = typeof import("../src/runtime/motion");
type Runtime = Omit<Motion, "transition" | "stop"> &
  typeof import("../src/runtime/graph") &
  typeof import("../src/runtime/interactions") &
  typeof import("../src/runtime/stacks") &
  Pick<typeof import("../src/runtime/search"), "initSearch"> &
  Pick<typeof import("../src/runtime/graph-assets"), "loadGraphAssets"> &
  Pick<typeof import("../src/runtime/toc"), "visibleHeadingIndex"> & {
    // VM-only DOM doubles; the browser entry points retain their real DOM types.
    transition(
      element: Element,
      keyframes: Parameters<Motion["transition"]>[1],
      duration?: Parameters<Motion["transition"]>[2],
    ): ReturnType<Motion["transition"]>;
    stop(element: Element): void;
    initNavigationMotion(options: {
      win: object;
      doc: object;
    }): ReturnType<
      typeof import("../src/runtime/navigation-motion").initNavigationMotion
    >;
    revealCalloutAncestors(target: {
      closest: (selector: string) => { open: boolean } | null | undefined;
    }): boolean;
  };
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
const bundle = await build({
  stdin: {
    contents:
      "export * from './src/runtime/motion.ts';export {initGraph} from './src/runtime/graph.ts';export * from './src/runtime/interactions.ts';export {initNavigationMotion} from './src/runtime/navigation-motion.ts';export {initSearch} from './src/runtime/search.ts';export {loadGraphAssets} from './src/runtime/graph-assets.ts';export {visibleHeadingIndex,revealCalloutAncestors} from './src/runtime/toc.ts';export {initStacks} from './src/runtime/stacks.ts';",
    resolveDir: resolve("."),
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "Runtime",
  platform: "browser",
  define: { "import.meta.url": '"https://example.test/site.js"' },
});
type TestStyle = Pick<
  CSSStyleDeclaration,
  | "getPropertyValue"
  | "getPropertyPriority"
  | "setProperty"
  | "removeProperty"
  | "transform"
  | "opacity"
  | "height"
>;
function style(): TestStyle {
  const values = new Map<PropertyKey, { value: string; priority: string }>();
  const declaration = new Proxy(
    {
      getPropertyValue: (k: string) => values.get(k)?.value || "",
      getPropertyPriority: (k: string) => values.get(k)?.priority || "",
      setProperty: (k: string, value: string, priority = "") => {
        values.set(k, { value: String(value), priority });
      },
      removeProperty: (k: string) => {
        const value = values.get(k)?.value || "";
        values.delete(k);
        return value;
      },
    },
    {
      get: (target, k) =>
        k in target ? Reflect.get(target, k) : values.get(k)?.value || "",
      set: (_, k, value) => {
        values.set(k, { value: String(value), priority: "" });
        return true;
      },
    },
  );
  return declaration as TestStyle;
}
interface TestAnimation {
  keyframes: PropertyIndexedKeyframes;
  playState: AnimationPlayState;
  currentTime: number;
  playbackRate: number;
  onfinish?: () => void;
  cancel(): void;
  finish(): void;
}
class Element extends EventTarget {
  style = style();
  animations: TestAnimation[] = [];
  isConnected = true;
  declare tagName: string;
  declare dataset: Record<string, string>;
  declare hidden: boolean;
  declare open: boolean;
  declare textContent: string;
  declare value: string;
  declare children: Element[];
  declare append: (...children: Element[]) => void;
  declare replaceChildren: () => void;
  declare remove: () => void;
  declare setAttribute: (key: string, value: string) => void;
  declare focus: () => void;
  declare showModal: () => void;
  declare close: () => void;
  declare getBoundingClientRect: () => DOMRect;
  declare querySelector: (selector: string) => Element | undefined;
  declare classList: {
    toggle: (key: string, on: boolean) => unknown;
    contains?: (key: string) => boolean;
    add?: (key: string) => unknown;
  };
  click() {
    this.dispatchEvent(new Event("click"));
  }
  animate(keyframes: PropertyIndexedKeyframes, options: { duration: number }) {
    const animation: TestAnimation = {
      keyframes,
      playState: "running",
      currentTime: options.duration,
      playbackRate: 1,
      cancel() {
        this.playState = "idle";
      },
      finish() {
        if (this.playState !== "running") return;
        this.playState = "finished";
        this.onfinish?.();
      },
    };
    this.animations.push(animation);
    return animation;
  }
}
function environment(globals: Record<string, unknown> = {}) {
  const media = Object.assign(new EventTarget(), { matches: false });
  const context = {
    EventTarget,
    console,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    matchMedia: () => media,
    ...globals,
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  return {
    ...(context as typeof context & { Runtime: Runtime }).Runtime,
    media,
  };
}
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
function graphEnvironment(load?: () => Promise<GraphAssets>) {
  const dialog = new Element(),
    trigger = new Element(),
    closeButton = new Element(),
    viewport = new Element(),
    status = new Element(),
    retry = new Element();
  dialog.dataset = { root: "../", current: "one" };
  viewport.replaceChildren = () => {};
  let mounted = 0,
    destroyed = 0;
  const mount = () => {
    mounted++;
    return { destroy: () => destroyed++ };
  };
  trigger.hidden = true;
  dialog.open = false;
  dialog.getBoundingClientRect = () => rect(40, 40, 920, 600);
  const nodes: Record<string, Element> = {
    "#graph-dialog": dialog,
    "#open-graph": trigger,
    "#close-graph": closeButton,
    "#graph-viewport": viewport,
    "#graph-status": status,
    "#retry-graph": retry,
  };
  const document: {
    activeElement: Element | null;
    querySelector: (selector: string) => Element | null;
  } = {
    activeElement: trigger,
    querySelector: (selector) => nodes[selector] || null,
  };
  trigger.focus = () => {
    document.activeElement = trigger;
  };
  dialog.showModal = () => {
    dialog.open = true;
    document.activeElement = closeButton;
  };
  dialog.close = () => {
    dialog.open = false;
    document.activeElement = null;
    dialog.dispatchEvent(new Event("close"));
  };
  const runtime = environment({ document });
  let opened = 0;
  const controller = runtime.initGraph({
    beforeOpen: () => opened++,
    load: load || (() => Promise.resolve({ data: {}, mount })),
  });
  return {
    ...runtime,
    dialog,
    trigger,
    closeButton,
    document,
    controller,
    status,
    retry,
    mount,
    get mounted() {
      return mounted;
    },
    get destroyed() {
      return destroyed;
    },
    get opened() {
      return opened;
    },
  };
}
test("graph mounts without waiting for Motion, closes and restores focus; empty pages are a no-op", async () => {
  const g = graphEnvironment();
  assert.equal(g.trigger.hidden, false);
  g.trigger.click();
  assert.equal(g.dialog.open, true);
  assert.equal(g.opened, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    g.mounted,
    1,
    "ready graph must not wait for the entrance animation",
  );
  g.dialog.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(g.dialog.style.opacity, "");
  g.closeButton.click();
  assert.equal(g.dialog.open, false);
  assert.equal(g.document.activeElement, g.trigger);
  const empty = environment({ document: { querySelector: () => null } });
  assert.doesNotThrow(() => empty.initGraph().close());
});
test("graph Escape/backdrop cancel, inside clicks do not close; modal handoff suppresses focus restore", () => {
  const g = graphEnvironment();
  g.trigger.click();
  const inside = Object.assign(new Event("click"), {
    clientX: 80,
    clientY: 80,
  });
  g.dialog.dispatchEvent(inside);
  assert.equal(g.dialog.open, true);
  const cancel = new Event("cancel", { cancelable: true });
  g.dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(g.dialog.open, false);
  assert.ok(g.dialog.animations.every((a) => a.playState === "idle"));
  g.trigger.click();
  g.dialog.dispatchEvent(
    Object.assign(new Event("click"), { clientX: 0, clientY: 0 }),
  );
  assert.equal(g.dialog.open, false);
  g.trigger.click();
  g.controller.close({ restoreFocus: false });
  assert.notEqual(g.document.activeElement, g.trigger);
});
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
  const link = new Element(),
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
  link.dispatchEvent(new Event("focus"));
  link.dispatchEvent(new Event("pointerleave"));
  assert.ok(classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 1);
  link.dispatchEvent(new Event("blur"));
  assert.ok(!classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 2);
  assert.equal(arrow.animations[0].playState, "idle");
  r.media.matches = true;
  r.media.dispatchEvent(new Event("change"));
  assert.equal(arrow.animations[1].playState, "idle");
  assert.equal(arrow.style.transform, "");
  link.dispatchEvent(new Event("focus"));
  assert.ok(classes.has("is-emphasized"));
  assert.equal(arrow.animations.length, 2);
});
test("global graph load is close-safe, retryable and releases the viewer on close", async () => {
  let resolveLoad!: (assets: GraphAssets) => void;
  const late = graphEnvironment(
    () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
  );
  late.trigger.click();
  late.closeButton.click();
  resolveLoad({ data: {}, mount: late.mount });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(late.mounted, 0);
  let attempts = 0;
  const retry = graphEnvironment(() =>
    ++attempts === 1
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ data: {}, mount: retry.mount }),
  );
  retry.trigger.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(retry.retry.hidden, false);
  assert.ok(retry.status.textContent.includes("加载失败"));
  retry.retry.click();
  retry.dialog.animations.forEach((a) => a.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(retry.mounted, 1);
  assert.equal(retry.status.hidden, true);
  retry.closeButton.click();
  assert.equal(retry.destroyed, 1);
});
test("global graph fetch is lazy, shared and retryable", async () => {
  let loads = 0;
  const data = { version: 1 };
  const runtime = environment({
    document: { body: { dataset: { graphIndex: "/preview/data/graph.json" } } },
    fetch: async (url: string) => {
      assert.equal(url, "/preview/data/graph.json");
      loads++;
      return { ok: loads > 1, json: async () => data };
    },
  });
  assert.equal(loads, 0);
  const first = runtime.loadGraphAssets(),
    same = runtime.loadGraphAssets();
  assert.equal(first, same);
  await assert.rejects(first);
  const result = await runtime.loadGraphAssets();
  assert.equal(result.data, data);
  assert.equal(typeof result.mount, "function");
  assert.equal(await runtime.loadGraphAssets(), result);
  assert.equal(loads, 2);
});
test("reading position skips closed callout headings and anchor reveal opens only closed ancestors", () => {
  const runtime = environment();
  assert.equal(runtime.visibleHeadingIndex([100, null, 500], 300), 0);
  assert.equal(runtime.visibleHeadingIndex([100, 500, null], 900, true), 1);
  assert.equal(runtime.visibleHeadingIndex([null, null], 900, true), -1);
  assert.equal(runtime.visibleHeadingIndex([null, 100], 0), 1);
  const parents = [{ open: false }, { open: false }];
  const target = { closest: () => parents.find((n) => !n.open) };
  assert.equal(runtime.revealCalloutAncestors(target), true);
  assert.ok(parents.every((n) => n.open));
  assert.equal(runtime.revealCalloutAncestors(target), false);
  assert.equal(runtime.revealCalloutAncestors({ closest: () => null }), false);
});
function stackEnvironment({ canHover = true, hash = "" } = {}) {
  const document = Object.assign(new EventTarget(), {
      activeElement: null as Node | null,
      querySelectorAll: (_selector: string): Node[] => [],
    }),
    window = new EventTarget(),
    hover = Object.assign(new EventTarget(), { matches: canHover }),
    reduced = Object.assign(new EventTarget(), { matches: false });
  class Node extends Element {
    attrs = new Map<string, string>();
    children: Node[] = [];
    parentElement: Node | null = null;
    id = "";
    textContent = "";
    inert = false;
    disabled = false;
    scrolled = false;
    classes = new Set<string>();
    classList = {
      add: (c: string) => this.classes.add(c),
      contains: (c: string) => this.classes.has(c),
      toggle: (c: string, on: boolean) =>
        on ? this.classes.add(c) : this.classes.delete(c),
    };
    setAttribute = (k: string, v: string) => {
      this.attrs.set(k, String(v));
    };
    getAttribute(k: string) {
      return this.attrs.get(k);
    }
    append = (...nodes: Element[]) => {
      nodes.forEach((n) => {
        assert.ok(n instanceof Node);
        n.parentElement = this;
        this.children.push(n);
      });
    };
    contains(node: Element): boolean {
      return node === this || this.children.some((c) => c.contains(node));
    }
    closest(selector: string): Node | null {
      if (this.classes.has(selector.slice(1))) return this;
      return this.parentElement?.closest(selector) || null;
    }
    querySelectorAll(selector: string) {
      const out: Node[] = [];
      const walk = (n: Node) => {
        for (const c of n.children) {
          if (
            selector === "button.stack-count"
              ? c.classes.has("stack-count")
              : c.classes.has(selector.slice(1))
          )
            out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }
    querySelector = (selector: string) => this.querySelectorAll(selector)[0];
    focus = () => {
      document.activeElement = this;
      emit(group, "focusin", { target: this });
    };
    getBoundingClientRect = (): DOMRect => {
      const i = cards.indexOf(this),
        open = group.classList.contains("is-open");
      const top = i < 0 ? 0 : open ? i * 160 : i * 26;
      return rect(0, top, 400, 140);
    };
    scrollIntoView() {
      this.scrolled = true;
    }
  }
  const root = new Node(),
    group = new Node(),
    count = new Node(),
    deck = new Node(),
    cards = Array.from({ length: 3 }, () => new Node()),
    link = new Node(),
    outside = new Node();
  root.classes.add("folder-frame");
  group.classes.add("card-stack");
  group.id = "folder-fixture";
  group.dataset = { folder: "课程" };
  count.classes.add("stack-count");
  count.textContent = "3 篇文章";
  count.disabled = true;
  deck.classes.add("stack-deck");
  cards.forEach((c) => c.classes.add("stack-card"));
  cards[1].append(link);
  deck.append(...cards);
  group.append(count, deck);
  root.append(group);
  document.querySelectorAll = (s) =>
    s === ".card-stack:not(.single)"
      ? [group]
      : s === ".folder-frame"
        ? [root]
        : [];
  document.activeElement = outside;
  const location = { hash };
  const runtime = environment({
    document,
    location,
    innerHeight: 800,
    addEventListener: window.addEventListener.bind(window),
    matchMedia: (q: string) => (q.includes("any-hover") ? hover : reduced),
    getComputedStyle: (n: Node) => ({
      transform:
        n.style.transform ||
        (!group.classList.contains("is-open") && cards.indexOf(n) > 0
          ? "matrix(1,0,0,1,0,26)"
          : "none"),
    }),
  });
  runtime.initStacks();
  return {
    document,
    window,
    hover,
    reduced,
    root,
    group,
    count,
    cards,
    link,
    outside,
    location,
    open: () => group.classList.contains("is-open"),
  };
}
function emit(
  node: EventTarget,
  type: string,
  values: Record<string, unknown> = {},
) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(event, key, { value });
  node.dispatchEvent(event);
  return event;
}
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
test("tag URL opens search with the filter applied, lazy-loads once and renders text-safe results", async () => {
  const ids = [
    "search-dialog",
    "search-input",
    "search-results",
    "search-count",
    "open-search",
    "close-search",
  ];
  class Document extends EventTarget {
    activeElement: Element | null = null;
    querySelector!: (selector: string) => Element;
    createElement!: (tag: string) => Element;
    body!: { dataset: { searchIndex: string } };
  }
  const document = new Document(),
    nodes = Object.fromEntries(ids.map((id) => ["#" + id, new Element()]));
  function element(tag: string) {
    const e = new Element();
    e.tagName = tag;
    e.children = [];
    e.setAttribute = () => {};
    e.append = (...children) => e.children.push(...children);
    e.replaceChildren = () => {
      e.children = [];
    };
    e.remove = () => {};
    return e;
  }
  const results = (nodes["#search-results"] = element("ul")),
    dialog = nodes["#search-dialog"],
    input = nodes["#search-input"];
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
  };
  input.focus = () => {
    document.activeElement = input;
  };
  document.querySelector = (selector) => nodes[selector];
  document.createElement = element;
  let loads = 0;
  document.body = { dataset: { searchIndex: "/preview/data/search.json" } };
  const records = [
    {
      title: "<COW>",
      url: "/preview/articles/os",
      tags: ["主题/操作系统"],
      summary: "safe",
    },
    { title: "Other", url: "/preview/articles/other", tags: ["工具/Obsidian"] },
  ];
  class Worker {
    onmessage!: (event: {
      data: { id: number; records: typeof records };
    }) => void;
    constructor() {
      loads++;
    }
    postMessage({
      id,
      url,
      query,
    }: {
      id: number;
      url: string;
      query: string;
    }) {
      assert.equal(url, "https://example.test/preview/data/search.json");
      queueMicrotask(() =>
        this.onmessage({
          data: { id, records: query ? records.slice(0, 1) : records },
        }),
      );
    }
    terminate() {}
  }
  const runtime = environment({
    document,
    URL,
    Worker,
    location: {
      href: "https://example.test/preview/",
      search: "?tag=" + encodeURIComponent("主题/操作系统"),
    },
    getComputedStyle: (e: Element) => ({
      opacity: e.style.opacity || "1",
      transform: e.style.transform || "none",
    }),
  });
  runtime.initSearch({ prefix: "", beforeOpen: () => {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dialog.open, true);
  assert.equal(input.value, "#主题/操作系统");
  assert.equal(results.children.length, 1);
  assert.equal(
    results.children[0].children[0].children[1].children[0].textContent,
    "<COW>",
  );
  nodes["#open-search"].click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(input.value, "");
  assert.equal(results.children.length, 2);
  assert.equal(loads, 1);
});
