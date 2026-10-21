// Node-only controller tests. Fake DOM/WAAPI boundaries, no browser or visual model.
import { build } from "esbuild";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
type Motion = typeof import("../../src/runtime/motion");
type Runtime = Omit<Motion, "transition" | "stop"> &
  typeof import("../../src/runtime/graph") &
  typeof import("../../src/runtime/interactions") &
  typeof import("../../src/runtime/card-motion") &
  typeof import("../../src/runtime/stacks") &
  Pick<typeof import("../../src/runtime/search"), "initSearch"> &
  Pick<typeof import("../../src/runtime/graph-assets"), "loadGraphAssets"> &
  Pick<typeof import("../../src/runtime/toc"), "visibleHeadingIndex"> & {
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
      typeof import("../../src/runtime/navigation-motion").initNavigationMotion
    >;
    revealCalloutAncestors(target: {
      closest: (selector: string) => { open: boolean } | null | undefined;
    }): boolean;
  };
const bundle = await build({
  stdin: {
    contents:
      "export * from './src/runtime/motion.ts';export {initGraph} from './src/runtime/graph.ts';export * from './src/runtime/interactions.ts';export * from './src/runtime/card-motion.ts';export {initNavigationMotion} from './src/runtime/navigation-motion.ts';export {initSearch} from './src/runtime/search.ts';export {loadGraphAssets} from './src/runtime/graph-assets.ts';export {visibleHeadingIndex,revealCalloutAncestors} from './src/runtime/toc.ts';export {initStacks} from './src/runtime/stacks.ts';",
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
export class Element extends EventTarget {
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
export function environment(globals: Record<string, unknown> = {}) {
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
