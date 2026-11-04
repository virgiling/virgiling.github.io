import { transition, stop, reduced, durations } from "./motion";

/** Only marked external prose links animate, including imported previews. */
export function initLinkUnderline(doc: Document = document) {
  const active = new Set<HTMLAnchorElement>();
  let hovered: HTMLAnchorElement | undefined,
    focused: HTMLAnchorElement | undefined;
  const listeners: (() => void)[] = [];
  function candidate(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (
      !link ||
      link.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
      !link.textContent?.trim() ||
      !link.querySelector(".external-link-mark") ||
      link.closest(
        "nav,.breadcrumb,.tag,.inline-tag,.heading-anchor,[role=button],[data-card-motion],[data-control-motion],.stack-card",
      ) ||
      link.querySelector("img,svg")
    )
      return;
    if (active.has(link)) return link;
    const style = getComputedStyle(link);
    // Do not replace an authored background or animate non-underlined controls.
    if (
      style.textDecorationLine.includes("underline") &&
      style.backgroundImage === "none"
    )
      return link;
  }
  function release(link: HTMLAnchorElement) {
    stop(link);
    link.classList.remove("is-link-underlined");
    active.delete(link);
  }
  function reset() {
    for (const link of active) release(link);
    hovered = focused = undefined;
  }
  function sync() {
    if (reduced.matches || doc.hidden) return reset();
    for (const link of active)
      if (link !== hovered && link !== focused) release(link);
    for (const link of [hovered, focused]) {
      if (!link || active.has(link)) continue;
      active.add(link);
      link.classList.add("is-link-underlined");
      void transition(
        link,
        { backgroundSize: ["0% 2px", "100% 2px"] },
        durations.linkUnderline,
        "linear",
      );
    }
  }
  function listen(
    target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
    type: string,
    handler: (e: Event) => void,
  ) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }
  for (const type of ["pointerover", "pointerout"])
    listen(doc, type, (event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType === "touch") return;
      hovered = candidate(
        type === "pointerover" ? pointer.target : pointer.relatedTarget,
      );
      sync();
    });
  for (const type of ["focusin", "focusout"])
    listen(doc, type, (event) => {
      const focus = event as FocusEvent;
      focused = candidate(
        type === "focusin" ? focus.target : focus.relatedTarget,
      );
      sync();
    });
  listen(reduced, "change", reset);
  listen(doc, "visibilitychange", reset);
  return {
    destroy() {
      reset();
      listeners.splice(0).forEach((remove) => remove());
    },
  };
}
