import { transition, stop, durations } from "./motion";
export function navMarkerTransform(
  link: Pick<DOMRect, "left" | "width">,
  nav: Pick<DOMRect, "left">,
) {
  return `translateX(${link.left - nav.left + link.width / 4}px) scaleX(${link.width / 2})`;
}
export function initInteractionMotion() {
  const nav = document.querySelector<HTMLElement>(".topnav");
  if (nav) {
    const links = [...nav.querySelectorAll("a")],
      active =
        nav.querySelector<HTMLAnchorElement>("[aria-current]") || links[0];
    const marker = document.createElement("span");
    marker.className = "nav-motion-marker";
    marker.setAttribute("aria-hidden", "true");
    nav.append(marker);
    nav.classList.add("has-motion-marker");
    let selected = active;
    function move(link: HTMLAnchorElement | undefined, instant = false) {
      if (!link) return;
      selected = link;
      const from = getComputedStyle(marker).transform,
        target = navMarkerTransform(
          link.getBoundingClientRect(),
          nav!.getBoundingClientRect(),
        );
      stop(marker);
      marker.style.transform = target;
      if (!instant)
        transition(marker, { transform: [from, target] }, durations.navigation);
    }
    links.forEach((link) => {
      link.addEventListener("pointerenter", () => move(link));
      link.addEventListener("focus", () => move(link));
    });
    nav.addEventListener("pointerleave", () =>
      move(
        nav.contains(document.activeElement)
          ? document.activeElement?.closest<HTMLAnchorElement>("a") || active
          : active,
      ),
    );
    nav.addEventListener("focusout", (event) => {
      if (!nav.contains(event.relatedTarget as Node | null)) move(active);
    });
    addEventListener("resize", () => move(selected, true));
    document.fonts?.ready.then(() => move(selected, true));
    move(active, true);
  }
  for (const link of document.querySelectorAll<HTMLElement>(
    ".folder-heading-link",
  )) {
    const arrowNode = link.querySelector<SVGElement>(".folder-link-arrow");
    if (!arrowNode) continue;
    const arrow = arrowNode;
    let hovered = false,
      focused = false,
      active = false;
    function emphasize() {
      const next = hovered || focused;
      if (next === active) return;
      active = next;
      const from = getComputedStyle(arrow).transform;
      stop(arrow);
      link.classList.toggle("is-emphasized", next);
      transition(
        arrow,
        { transform: [from, getComputedStyle(arrow).transform] },
        durations.navigation,
      );
    }
    link.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") {
        hovered = true;
        emphasize();
      }
    });
    link.addEventListener("pointerleave", () => {
      hovered = false;
      emphasize();
    });
    link.addEventListener("focusin", () => {
      focused = true;
      emphasize();
    });
    link.addEventListener("focusout", (event) => {
      if (link.contains(event.relatedTarget as Node | null)) return;
      focused = false;
      emphasize();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    ".search-trigger,button.stack-count,.graph-expand,.dialog-close",
  )) {
    let pressed = false;
    function press(next: boolean) {
      if (next === pressed) return;
      pressed = next;
      const from = getComputedStyle(button).transform;
      stop(button);
      button.classList.toggle("motion-pressed", next);
      transition(
        button,
        { transform: [from, getComputedStyle(button).transform] },
        durations.press,
      );
    }
    button.addEventListener("pointerdown", (event) => {
      if (event.button === 0) press(true);
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave", "blur"])
      button.addEventListener(type, () => press(false));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") press(true);
    });
    button.addEventListener("keyup", () => press(false));
  }
}
