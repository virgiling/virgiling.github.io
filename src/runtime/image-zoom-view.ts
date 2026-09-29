import mediumZoom from "medium-zoom/dist/pure/index.js";
import { transition, stop } from "./motion";

// Keep medium-zoom's geometry, clones and interactions. Its pinned Bun patch
// exposes a Motion completion boundary rather than CSS transitionend/polling.
export function mountImageZoom(root: Document = document) {
  const images = [
    ...root.querySelectorAll<HTMLImageElement>("a[data-image-zoom] > img"),
  ];
  let disposed = false,
    previousFocus: HTMLElement | SVGElement | null | undefined,
    overflow: string | undefined,
    overlay: HTMLDivElement | undefined,
    button: HTMLButtonElement | undefined;
  const inert = new Map<HTMLElement, boolean>(),
    animated = new Set<HTMLElement>();
  function restore() {
    for (const [element, value] of inert) element.inert = value;
    inert.clear();
    document.body.style.overflow = overflow ?? "";
    if (previousFocus?.isConnected && !disposed)
      previousFocus.focus({ preventScroll: true });
    button?.remove();
    previousFocus = undefined;
    overlay = button = undefined;
  }
  function setupModal(node: HTMLImageElement, background: HTMLDivElement) {
    overlay = background;
    previousFocus =
      zoom.getZoomedImage()?.closest("a") ||
      (document.activeElement as HTMLElement | SVGElement | null);
    overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    for (const element of document.body
      .children as HTMLCollectionOf<HTMLElement>) {
      if (element === background || element === node) continue;
      inert.set(element, element.inert);
      element.inert = true;
    }
    background.setAttribute("role", "dialog");
    background.setAttribute("aria-modal", "true");
    background.setAttribute("aria-label", node.alt || "图片预览");
    node.id = "expanded-article-image";
    background.setAttribute("aria-owns", node.id);
    node.removeAttribute("data-zoom-src");
    button = document.createElement("button");
    button.type = "button";
    button.className = "image-zoom-close";
    button.textContent = "×";
    button.setAttribute("aria-label", "关闭图片预览");
    button.id = "close-expanded-image";
    background.setAttribute("aria-owns", `${node.id} ${button.id}`);
    document.body.append(button);
    button.addEventListener("click", () => zoom.close());
    background.addEventListener("click", (event) => {
      if (event.target === background) void zoom.close();
    });
    button.focus({ preventScroll: true });
  }
  const zoom = mediumZoom(images, {
    margin: 24,
    background: "rgba(250,249,246,.97)",
    manual: true,
    motion: async (nodes, background, transform, opening) => {
      if (opening) setupModal(nodes[0], background);
      if (disposed) return;
      const targets = [...nodes, background];
      targets.forEach((n) => animated.add(n));
      try {
        await Promise.all([
          ...nodes.map((node) =>
            transition(
              node,
              {
                transform: opening ? ["none", transform] : [transform, "none"],
              },
              0.22,
            ),
          ),
          transition(background, { opacity: opening ? [0, 1] : [1, 0] }, 0.18),
        ]);
      } finally {
        targets.forEach((n) => animated.delete(n));
      }
    },
  });
  zoom.on("closed", restore);
  function keydown(event: KeyboardEvent) {
    if (!overlay) return;
    if (event.key === "Tab") {
      event.preventDefault();
      button?.focus({ preventScroll: true });
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      void zoom.close();
    }
  }
  document.addEventListener("keydown", keydown, true);
  return {
    open: (image: HTMLImageElement) =>
      disposed ? Promise.resolve() : zoom.open({ target: image }),
    close: () => zoom.close(),
    async destroy() {
      disposed = true;
      for (const node of animated) stop(node);
      document.removeEventListener("keydown", keydown, true);
      await zoom.destroy();
      zoom.off("closed", restore);
    },
  };
}
