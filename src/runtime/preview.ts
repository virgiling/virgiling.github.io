import { transition, stop, durations } from "./motion";
import type { createPreviewLoader } from "./preview-content";

export interface PreviewRecord {
  slug: string;
  url: string;
  title: string;
}
type PreviewAnchor = HTMLElement | SVGElement;
export function initNotePreview({
  records,
  load,
}: {
  records: PreviewRecord[];
  load?: ReturnType<typeof createPreviewLoader>;
}) {
  const pop = document.querySelector<HTMLElement>("#note-preview")!,
    body = pop.querySelector<HTMLElement>(".popover-body")!,
    content = pop.querySelector<HTMLElement>("#preview-content")!,
    title = pop.querySelector<HTMLElement>("#preview-title")!,
    status = pop.querySelector<HTMLElement>("#preview-status")!,
    retry = pop.querySelector<HTMLButtonElement>("#retry-preview")!,
    pinButton = pop.querySelector<HTMLButtonElement>("#pin-preview")!,
    closeButton = pop.querySelector<HTMLButtonElement>("#close-preview")!,
    fullLink = pop.querySelector<HTMLAnchorElement>("#preview-link")!;
  let anchor: PreviewAnchor | undefined,
    active: PreviewRecord | undefined,
    pinned = false,
    generation = 0,
    showTimer: ReturnType<typeof setTimeout> | undefined,
    hideTimer: ReturnType<typeof setTimeout> | undefined,
    request: AbortController | undefined,
    requestTimer: ReturnType<typeof setTimeout> | undefined;
  let floating: Promise<typeof import("@floating-ui/dom")> | undefined;
  let engine: Promise<typeof import("./preview-content")> | undefined,
    defaultLoader: ReturnType<typeof createPreviewLoader> | undefined;
  const listeners: (() => void)[] = [];
  function listen(
    target: EventTarget,
    event: string,
    handler: (event: Event) => void,
  ) {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }
  function cancelRequest() {
    request?.abort();
    request = undefined;
    clearTimeout(requestTimer);
  }
  function pin(value: boolean) {
    pinned = value;
    pinButton.setAttribute("aria-pressed", String(value));
    pinButton.textContent = value ? "取消固定" : "固定";
  }
  async function position() {
    if (!anchor || pop.hidden) return false;
    const current = anchor,
      token = generation;
    try {
      const { computePosition, flip, shift, offset } = await (floating ??=
        import("@floating-ui/dom"));
      if (current !== anchor || token !== generation || pop.hidden)
        return false;
      const { x, y } = await computePosition(current, pop, {
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [offset(10), flip(), shift({ padding: 14 })],
      });
      if (current !== anchor || token !== generation || pop.hidden)
        return false;
      pop.style.left = `${x}px`;
      pop.style.top = `${y}px`;
      return true;
    } catch {
      floating = undefined;
      if (current === anchor && token === generation && !pop.hidden) {
        status.textContent = "预览定位失败，可以重试或打开原文。";
        status.hidden = false;
        retry.hidden = false;
      }
      return false;
    }
  }
  function revealHeading(heading: HTMLElement) {
    // Both incoming section links and in-preview links can target closed callouts.
    for (
      let parent = heading.parentElement;
      parent && parent !== content;
      parent = parent.parentElement
    )
      if (parent.tagName === "DETAILS")
        (parent as HTMLDetailsElement).open = true;
    body.scrollTop +=
      heading.getBoundingClientRect().top -
      body.getBoundingClientRect().top -
      12;
  }
  function hide(restore = false) {
    const previous = anchor;
    generation++;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    cancelRequest();
    stop(pop);
    pop.hidden = true;
    content.replaceChildren();
    content.removeAttribute("aria-busy");
    active = undefined;
    anchor = undefined;
    pin(false);
    if (restore && previous?.isConnected) {
      previous.focus({ preventScroll: true });
      clearTimeout(showTimer);
    }
  }
  async function show(
    target: PreviewAnchor,
    key: string | undefined,
    explicit = false,
    refresh = false,
  ) {
    if (target.closest("[data-local-graph].is-node-dragging")) return;
    const record = records.find((record) => record.slug === key);
    if (!record || (pinned && !explicit)) return;
    const pageURL = new URL(record.url, location.href);
    if (pageURL.origin !== location.origin) return;
    pageURL.hash = "";
    pageURL.search = "";
    if (!pop.hidden && active === record && anchor === target) {
      if (explicit) {
        pin(true);
        closeButton.focus({ preventScroll: true });
      }
      return;
    }
    const wasHidden = pop.hidden;
    cancelRequest();
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    const token = ++generation;
    anchor = target;
    active = record;
    pin(explicit);
    title.textContent = record.title;
    fullLink.href = pageURL.href;
    const authoredURL = new URL(
      target.getAttribute("href") ||
        (target.hasAttribute("data-open-preview")
          ? target.previousElementSibling?.getAttribute("href")
          : undefined) ||
        record.url,
      location.href,
    );
    let fragment = "";
    if (
      authoredURL.pathname === pageURL.pathname &&
      authoredURL.origin === pageURL.origin
    ) {
      fullLink.href = authoredURL.href;
      try {
        fragment = decodeURIComponent(authoredURL.hash.slice(1));
      } catch {
        /* keep malformed fragments harmless */
      }
    }
    content.replaceChildren();
    content.setAttribute("aria-busy", "true");
    status.textContent = "正在加载全文…";
    status.hidden = false;
    retry.hidden = true;
    body.scrollTop = 0;
    pop.hidden = false;
    void position();
    if (wasHidden) void transition(pop, { opacity: [0, 1] }, durations.popover);
    if (explicit) closeButton.focus({ preventScroll: true });
    const controller = (request = new AbortController());
    requestTimer = setTimeout(() => controller.abort(), 15000);
    try {
      const { createPreviewLoader, extractPreviewContent } = await (engine ??=
        import("./preview-content"));
      if (token !== generation || pop.hidden) return;
      controller.signal.throwIfAborted();
      const loader = load || (defaultLoader ??= createPreviewLoader());
      const html = await loader(pageURL, controller.signal, refresh);
      if (token !== generation || pop.hidden) return;
      controller.signal.throwIfAborted();
      let scope = `note-popout-${token}`;
      while (document.querySelector(`[id^="${scope}-"]`)) scope += "p";
      const preview = extractPreviewContent(html, record.slug, pageURL, scope);
      content.replaceChildren(...preview.container.childNodes);
      const headingId = preview.ids.get(fragment);
      const heading = [...content.querySelectorAll<HTMLElement>("[id]")].find(
        (node) => node.id === headingId,
      );
      if (heading) revealHeading(heading);
      if (await position()) status.hidden = true;
    } catch {
      if (token !== generation || pop.hidden) return;
      status.textContent = "全文预览加载失败，可以重试或打开原文。";
      retry.hidden = false;
    } finally {
      if (token === generation) {
        clearTimeout(requestTimer);
        request = undefined;
        content.removeAttribute("aria-busy");
      }
    }
  }
  function scheduleHide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (
        !pinned &&
        !pop.matches(":hover") &&
        !pop.contains(document.activeElement)
      )
        hide();
    }, 180);
  }
  document.querySelectorAll<PreviewAnchor>("[data-preview]").forEach((link) => {
    listen(link, "pointerenter", (event) => {
      if ((event as PointerEvent).pointerType === "touch") return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => void show(link, link.dataset.preview), 180);
    });
    listen(link, "pointerleave", scheduleHide);
    listen(link, "focus", () => {
      clearTimeout(showTimer);
      showTimer = setTimeout(() => void show(link, link.dataset.preview), 180);
    });
    listen(link, "blur", scheduleHide);
    listen(link, "click", () => hide());
  });
  document
    .querySelectorAll<HTMLElement>("[data-open-preview]")
    .forEach((button) =>
      listen(
        button,
        "click",
        () => void show(button, button.dataset.openPreview, true),
      ),
    );
  listen(pop, "pointerenter", () => clearTimeout(hideTimer));
  listen(pop, "pointerleave", scheduleHide);
  listen(pop, "focusout", scheduleHide);
  listen(pinButton, "click", () => pin(!pinned));
  listen(closeButton, "click", () => hide(true));
  listen(fullLink, "click", () => hide());
  listen(retry, "click", () => {
    if (!anchor || !active) return;
    const target = anchor,
      record = active,
      explicit = pinned;
    active = undefined;
    void show(target, record.slug, explicit, true);
  });
  listen(content, "click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      "a[href]",
    );
    const click = event as MouseEvent;
    if (
      !link?.dataset.previewAnchor ||
      event.defaultPrevented ||
      click.metaKey ||
      click.ctrlKey ||
      click.altKey ||
      click.shiftKey ||
      (click.button !== undefined && click.button !== 0)
    )
      return;
    const heading = [...content.querySelectorAll<HTMLElement>("[id]")].find(
      (node) => node.id === link.dataset.previewAnchor,
    );
    if (!heading) return;
    event.preventDefault();
    revealHeading(heading);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  });
  listen(document, "pointerdown", (event) => {
    const target = event.target as Element;
    if (target.closest("[data-local-graph]")) hide();
    else if (
      !pop.hidden &&
      !pop.contains(target) &&
      !target.closest("[data-preview],[data-open-preview]")
    )
      hide();
  });
  listen(document, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !pop.hidden) {
      event.preventDefault();
      hide(true);
    }
  });
  listen(window, "resize", () => void position());
  listen(window, "pagehide", () => hide());
  return {
    hide,
    position,
    destroy() {
      hide();
      listeners.splice(0).forEach((remove) => remove());
    },
  };
}
