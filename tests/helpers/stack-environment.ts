import assert from "node:assert/strict";
import { rect } from "./dom";
import { Element, environment } from "./runtime-bundle";

export function stackEnvironment({ canHover = true, hash = "" } = {}) {
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
export function emit(
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
