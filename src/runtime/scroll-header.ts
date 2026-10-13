import { transition, stop } from "./motion";

export function headerScrollState(
  state: { y: number; travel: number; visible: boolean },
  y: number,
  height: number,
  focused = false,
) {
  y = Math.max(0, y);
  const delta = y - state.y;
  const travel =
    Math.sign(delta) === Math.sign(state.travel) ? state.travel + delta : delta;
  const visible =
    focused || y <= height
      ? true
      : Math.abs(travel) >= 12
        ? travel < 0
        : state.visible;
  return { y, travel: visible !== state.visible ? 0 : travel, visible };
}
export function shortcutLabel(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘ K" : "Ctrl K";
}

export function initScrollHeader() {
  const header = document.querySelector<HTMLElement>(".topbar");
  if (!header) return { destroy() {} };
  const root = document.documentElement;
  const oldHeight = root.style.getPropertyValue("--topbar-height");
  let height = header.getBoundingClientRect().height;
  let state = { y: Math.max(0, scrollY), travel: 0, visible: true };
  let frame = 0,
    disposed = false;
  header.dataset.scrollHeader = "";
  function measure() {
    height = header!.getBoundingClientRect().height;
    root.style.setProperty("--topbar-height", `${height}px`);
  }
  function show(visible: boolean, animate = true) {
    if (!animate) stop(header!);
    if (header!.classList.contains("is-away") === !visible) return;
    const from = getComputedStyle(header!).transform;
    stop(header!);
    header!.classList.toggle("is-away", !visible);
    if (animate && !document.hidden)
      void transition(
        header!,
        {
          transform: [
            from === "none" ? "translateY(0)" : from,
            visible ? "translateY(0)" : "translateY(-100%)",
          ],
        },
        0.18,
      );
  }
  function update() {
    frame = 0;
    // Clamp elastic scrolling so an overscroll bounce does not reveal the bar.
    const y = Math.max(
      0,
      Math.min(scrollY, document.documentElement.scrollHeight - innerHeight),
    );
    state = headerScrollState(
      state,
      y,
      height,
      header!.contains(document.activeElement),
    );
    show(state.visible);
  }
  function scroll() {
    if (!frame && !disposed) frame = requestAnimationFrame(update);
  }
  function focus() {
    state.visible = true;
    state.travel = 0;
    show(true, false);
  }
  function visibility() {
    stop(header!);
    state = { ...state, y: Math.max(0, scrollY), travel: 0 };
  }
  const resize =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(measure)
      : undefined;
  resize?.observe(header);
  measure();
  addEventListener("resize", measure);
  addEventListener("scroll", scroll, { passive: true });
  header.addEventListener("focusin", focus);
  document.addEventListener("visibilitychange", visibility);
  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      stop(header);
      resize?.disconnect();
      removeEventListener("resize", measure);
      removeEventListener("scroll", scroll);
      header.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", visibility);
      header.classList.remove("is-away");
      delete header.dataset.scrollHeader;
      if (oldHeight) root.style.setProperty("--topbar-height", oldHeight);
      else root.style.removeProperty("--topbar-height");
    },
  };
}
