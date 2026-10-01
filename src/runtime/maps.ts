import { loadMapStyles } from "./map-styles";
interface MapView {
  destroy(): void;
}
interface MapModule {
  stylesheet: string;
  mountMapView(root: HTMLElement, source: string): MapView;
}
type Observe = (root: HTMLElement, show: () => void) => () => void;
const observeVisible: Observe = (root, show) => {
  if (typeof IntersectionObserver !== "function") {
    show();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        show();
      }
    },
    { rootMargin: "100px" },
  );
  observer.observe(root);
  return () => observer.disconnect();
};
export function initMaps({
  root = document,
  load = () => import("./map-view"),
  observe = observeVisible,
  styles = loadMapStyles,
}: {
  root?: Document;
  load?: () => Promise<MapModule>;
  observe?: Observe;
  styles?: typeof loadMapStyles;
} = {}) {
  const cleanup: Array<() => void> = [];
  for (const element of root.querySelectorAll<HTMLElement>("[data-map]")) {
    const status = element.querySelector<HTMLElement>(".map-status");
    const retry = element.querySelector<HTMLButtonElement>(".map-retry");
    if (!status || !retry) continue;
    let controller = new AbortController();
    let disposed = false,
      pending = false,
      view: MapView | undefined;
    function release() {
      view?.destroy();
      view = undefined;
      const host = element.querySelector<
        HTMLElement & { disconnectedCallback?: () => void }
      >("astro-leaflet");
      host?.disconnectedCallback?.();
    }
    async function render() {
      if (disposed || pending || view) return;
      pending = true;
      status!.hidden = false;
      status!.textContent = "正在加载足迹地图…";
      retry!.hidden = true;
      try {
        const source = element.dataset.map ?? "";
        JSON.parse(source); // Reject malformed JSON before fetching the engine.
        const module = await load();
        if (disposed) return;
        await styles(
          element.ownerDocument,
          module.stylesheet,
          controller.signal,
        );
        if (disposed) return;
        view = module.mountMapView(element, source);
        status!.hidden = true;
      } catch {
        if (!disposed) {
          controller.abort();
          controller = new AbortController();
          release();
          status!.hidden = false;
          status!.textContent = "地图加载失败，请重试。";
          retry!.hidden = false;
        }
      } finally {
        pending = false;
      }
    }
    const click = () => {
      void render();
    };
    retry.addEventListener("click", click);
    const stop = observe(element, click);
    cleanup.push(() => {
      disposed = true;
      controller.abort();
      stop();
      retry.removeEventListener("click", click);
      release();
    });
  }
  return {
    destroy() {
      cleanup.splice(0).forEach((dispose) => dispose());
    },
  };
}
