import { transition, stop, durations } from "./motion";

// Keep native navigation, focus, downloads, modified clicks and history scroll
// restoration. Enhance the arriving document, not a second client-side router.
export function initNavigationMotion({
  win = window,
  doc = document,
}: { win?: Window; doc?: Document } = {}) {
  const main = doc.querySelector<HTMLElement>("#main");
  let shown = false,
    disposed = false,
    heading: HTMLElement | null | undefined;
  function highlightHash() {
    if (disposed) return;
    if (heading) stop(heading);
    try {
      heading = doc.getElementById(
        decodeURIComponent(win.location.hash.slice(1)),
      );
    } catch {
      heading = undefined;
    }
    if (heading)
      void transition(
        heading,
        { backgroundColor: ["rgba(223,232,210,0.85)", "rgba(223,232,210,0)"] },
        durations.navigation,
      );
  }
  function enter(event: { persisted?: boolean } = {}) {
    if (disposed || (shown && !event.persisted)) return;
    shown = true;
    if (main) {
      const history =
        event.persisted ||
        (
          win.performance?.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined
        )?.type === "back_forward";
      void transition(
        main,
        history
          ? { opacity: [0.82, 1] }
          : { opacity: [0.82, 1], transform: ["translateY(4px)", "none"] },
        durations.navigation,
      );
    }
    highlightHash();
  }
  function leave() {
    shown = false;
    if (main) stop(main);
    if (heading) stop(heading);
    heading = undefined;
  }
  win.addEventListener("pageshow", enter);
  win.addEventListener("pagehide", leave);
  win.addEventListener("hashchange", highlightHash);
  if (doc.readyState === "complete") enter();
  return {
    destroy() {
      disposed = true;
      leave();
      win.removeEventListener("pageshow", enter);
      win.removeEventListener("pagehide", leave);
      win.removeEventListener("hashchange", highlightHash);
    },
  };
}
