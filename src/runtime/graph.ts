import { transition, stop, durations } from "./motion";
import { loadGraphAssets, type GraphAssets } from "./graph-assets";
export interface CloseOptions {
  restoreFocus?: boolean;
}
interface GraphOptions {
  beforeOpen?: () => void;
  load?: () => Promise<GraphAssets>;
}
export function initGraph({
  beforeOpen = () => {},
  load = loadGraphAssets,
}: GraphOptions = {}) {
  const dialogNode = document.querySelector<HTMLDialogElement>("#graph-dialog"),
    trigger = document.querySelector<HTMLButtonElement>("#open-graph");
  if (!dialogNode || !trigger) return { close: () => {} };
  const dialog = dialogNode;
  const viewport = document.querySelector<HTMLElement>("#graph-viewport")!,
    status = document.querySelector<HTMLElement>("#graph-status")!,
    retry = document.querySelector<HTMLButtonElement>("#retry-graph")!;
  let opener: HTMLElement | SVGElement | null,
    restoreFocus = true,
    view: ReturnType<GraphAssets["mount"]> | undefined,
    request = 0;
  async function render() {
    const ticket = ++request;
    status.hidden = false;
    status.textContent = "正在加载全局图谱…";
    retry.hidden = true;
    try {
      const { data, mount } = await load();
      if (ticket !== request || !dialog.open) return;
      view = mount(viewport, data, { current: dialog.dataset.current });
      status.hidden = true;
    } catch {
      if (ticket !== request || !dialog.open) return;
      status.textContent = "图谱加载失败，请重试。";
      retry.hidden = false;
    }
  }
  function close(options: CloseOptions = {}) {
    restoreFocus = options.restoreFocus !== false;
    if (dialog.open) dialog.close();
  }
  trigger.hidden = false;
  // Warm only on explicit pointer/keyboard intent, not every page's first paint.
  const warm = () => {
    void load().catch(() => {});
  };
  trigger.addEventListener("pointerenter", warm);
  trigger.addEventListener("focus", warm);
  trigger.addEventListener("pointerdown", warm);
  trigger.addEventListener("click", () => {
    if (dialog.open) return;
    opener = document.activeElement as HTMLElement | SVGElement | null;
    restoreFocus = true;
    beforeOpen();
    dialog.showModal();
    transition(
      dialog,
      { opacity: [0, 1], transform: ["translateY(8px) scale(.97)", "none"] },
      durations.spotlightIn,
    );
    void render();
  });
  retry.addEventListener("click", () => {
    void render();
  });
  document
    .querySelector<HTMLButtonElement>("#close-graph")!
    .addEventListener("click", () => close());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    ++request;
    view?.destroy();
    view = undefined;
    viewport.replaceChildren();
    stop(dialog);
    if (restoreFocus && opener?.isConnected)
      opener.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      close();
  });
  return { close };
}
