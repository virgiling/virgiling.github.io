import type { GraphAssets } from "../../src/runtime/graph-assets";
import { rect } from "./dom";
import { Element, environment } from "./runtime-bundle";

export function graphEnvironment(load?: () => Promise<GraphAssets>) {
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
