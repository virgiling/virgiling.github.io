import { transition, stop, reduced, durations } from "./motion";

// Cards explicitly opt in; archive stacks keep their own transform controller.
export function initCardMotion() {
  const hoverable = matchMedia("(any-hover: hover)");
  const cleanup: Array<() => void> = [];
  const syncCards: Array<(instant?: boolean) => void> = [];
  let disposed = false;
  for (const card of document.querySelectorAll<HTMLElement>(
    "[data-card-motion]:not(.stack-card)",
  )) {
    let hovered = hoverable.matches && card.matches(":hover"),
      focused = card.contains(document.activeElement),
      emphasized = false;
    function sync(instant = false) {
      if (disposed) return;
      if (!hoverable.matches || document.hidden) hovered = false;
      const next = !document.hidden && !reduced.matches && (hovered || focused);
      if (next === emphasized && !instant) return;
      const from = getComputedStyle(card).transform;
      stop(card);
      emphasized = next;
      card.classList.toggle("is-card-emphasized", next);
      if (!instant)
        void transition(
          card,
          { transform: [from, getComputedStyle(card).transform] },
          durations.cardHover,
        );
    }
    function listen<K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ) {
      card.addEventListener(type, handler);
      cleanup.push(() => card.removeEventListener(type, handler));
    }
    listen("pointerenter", (event) => {
      if (event.pointerType === "touch" || !hoverable.matches) return;
      hovered = true;
      sync();
    });
    const leave = () => {
      hovered = false;
      sync();
    };
    listen("pointerleave", leave);
    listen("pointercancel", leave);
    listen("focusin", () => {
      focused = true;
      sync();
    });
    listen("focusout", (event) => {
      if (card.contains(event.relatedTarget as Node | null)) return;
      focused = false;
      sync();
    });
    syncCards.push(sync);
    sync(true);
    cleanup.push(() => {
      stop(card);
      card.classList.remove("is-card-emphasized");
    });
  }
  const preferences = () => syncCards.forEach((sync) => sync(true));
  reduced.addEventListener("change", preferences);
  hoverable.addEventListener("change", preferences);
  document.addEventListener("visibilitychange", preferences);
  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      reduced.removeEventListener("change", preferences);
      hoverable.removeEventListener("change", preferences);
      document.removeEventListener("visibilitychange", preferences);
      cleanup.splice(0).forEach((dispose) => dispose());
      syncCards.length = 0;
    },
  };
}
