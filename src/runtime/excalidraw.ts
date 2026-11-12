export interface DrawingOptions {
  fileContent: string;
  alt: string;
  width?: number;
  height?: number;
  onRender: () => void;
  onError: (error: unknown) => void;
}
export interface DrawingRenderer {
  mountDrawing(target: HTMLElement, options: DrawingOptions): () => void;
}
interface Options {
  root?: Document | HTMLElement;
  load?: () => Promise<DrawingRenderer>;
  fetcher?: typeof fetch;
}

// Keep React and the Excalidraw renderer out of the initial module graph.
// The observer also covers drawings added by full-article previews.
export function initExcalidraw({
  root = document,
  load = () => import("./excalidraw-view"),
  fetcher = fetch,
}: Options = {}) {
  const owner = root.ownerDocument || (root as Document);
  let disposed = false;
  let pending: Promise<DrawingRenderer> | undefined;
  const prepare = () =>
    (pending ??= load().catch((error) => {
      pending = undefined;
      throw error;
    }));
  const states = new Map<
    HTMLElement,
    { start: () => void; destroy: () => void }
  >();
  const observer =
    typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                observer!.unobserve(entry.target);
                states.get(entry.target as HTMLElement)?.start();
              }
          },
          { rootMargin: "200px" },
        );

  function register(figure: HTMLElement) {
    const original = [...figure.childNodes];
    const originalStyle = figure.getAttribute("style");
    const target = owner.createElement("div");
    const status = owner.createElement("p");
    const retry = owner.createElement("button");
    status.setAttribute("role", "status");
    retry.type = "button";
    retry.textContent = "重试绘图";
    retry.hidden = true;
    figure.append(status, retry, target);
    const positive = (value: string | undefined) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : undefined;
    };
    const width = positive(figure.dataset.width);
    const height = positive(figure.dataset.height);
    if (width) figure.style.maxWidth = `${width}px`;
    let controller: AbortController | undefined;
    let unmount: (() => void) | undefined;
    let loading = false;
    let ready = false;
    function failed() {
      if (controller?.signal.aborted || disposed) return;
      loading = false;
      figure.removeAttribute("aria-busy");
      status.textContent = "绘图加载失败。可以重试，或下载绘图数据。";
      retry.hidden = false;
    }
    async function start() {
      if (disposed || loading || ready) return;
      loading = true;
      unmount?.();
      unmount = undefined;
      controller = new AbortController();
      const signal = controller.signal;
      const started = performance.now();
      figure.setAttribute("aria-busy", "true");
      status.textContent = "正在加载绘图…";
      retry.hidden = true;
      try {
        const [renderer, response] = await Promise.all([
          prepare(),
          fetcher(figure.dataset.excalidraw!, {
            signal,
            credentials: "same-origin",
            redirect: "error",
          }),
        ]);
        if (!response.ok) throw new Error("Drawing request failed");
        const fileContent = await response.text();
        if (signal.aborted || disposed) return;
        unmount = renderer.mountDrawing(target, {
          fileContent,
          alt: figure.dataset.label || "Excalidraw",
          width,
          height,
          onRender: () => {
            if (signal.aborted || disposed) return;
            ready = true;
            loading = false;
            figure.removeAttribute("aria-busy");
            figure.replaceChildren(target);
            figure.dataset.renderMs = String(
              Math.round(performance.now() - started),
            );
            performance.measure("excalidraw:ready", {
              start: started,
              end: performance.now(),
            });
          },
          onError: failed,
        });
      } catch {
        failed();
      }
    }
    const click = () => void start();
    retry.addEventListener("click", click);
    states.set(figure, {
      start: click,
      destroy: () => {
        controller?.abort();
        unmount?.();
        observer?.unobserve(figure);
        retry.removeEventListener("click", click);
        figure.replaceChildren(...original);
        figure.removeAttribute("aria-busy");
        delete figure.dataset.renderMs;
        if (originalStyle === null) figure.removeAttribute("style");
        else figure.setAttribute("style", originalStyle);
      },
    });
    if (observer) observer.observe(figure);
    else click();
  }
  function scan() {
    if (disposed) return;
    for (const [figure, state] of states)
      if (!root.contains(figure)) {
        state.destroy();
        states.delete(figure);
      }
    for (const figure of root.querySelectorAll<HTMLElement>(
      "figure[data-excalidraw]",
    ))
      if (!states.has(figure)) register(figure);
  }
  scan();
  const changes = new MutationObserver(scan);
  changes.observe(root, { childList: true, subtree: true });
  return {
    destroy() {
      disposed = true;
      changes.disconnect();
      observer?.disconnect();
      for (const state of states.values()) state.destroy();
      states.clear();
    },
  };
}
