export function initCodeCopy(
  doc: Document = document,
  clipboard: Pick<Clipboard, "writeText"> | undefined = navigator.clipboard,
) {
  let disposed = false;
  const buttons = new Set<HTMLButtonElement>();
  const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  const versions = new WeakMap<HTMLButtonElement, number>();
  const states = {
    idle: {
      label: "复制",
      title: "复制代码",
      path: "M8 8h12v12H8zM16 8V4H4v12h4",
    },
    copied: { label: "已复制", title: "代码已复制", path: "m5 12 4 4L19 6" },
    failed: {
      label: "复制失败，请手动选择",
      title: "复制失败，请手动选择代码",
      path: "m6 6 12 12M6 18 18 6",
    },
  };
  function showState(button: HTMLButtonElement, state: keyof typeof states) {
    const { label, title, path } = states[state];
    button.querySelector(".sr-only")!.textContent = label;
    button.querySelector("path")!.setAttribute("d", path);
    button.setAttribute("aria-label", title);
    button.title = title;
  }
  function prepare(root: ParentNode) {
    root.querySelectorAll<HTMLElement>(".code-block").forEach((block) => {
      if (!block.querySelector("pre code") || block.querySelector(".copy-code"))
        return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.setAttribute("aria-live", "polite");
      const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      for (const [name, value] of Object.entries({
        viewBox: "0 0 24 24",
        width: "16",
        height: "16",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      }))
        icon.setAttribute(name, value);
      icon.append(doc.createElementNS("http://www.w3.org/2000/svg", "path"));
      const label = doc.createElement("span");
      label.className = "sr-only";
      button.append(icon, label);
      showState(button, "idle");
      block.append(button);
      buttons.add(button);
    });
  }
  async function copy(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(".copy-code");
    const code = button?.closest(".code-block")?.querySelector("pre code");
    if (!button || !code || !buttons.has(button)) return;
    const version = (versions.get(button) || 0) + 1;
    versions.set(button, version);
    clearTimeout(timers.get(button));
    try {
      if (!clipboard) throw new Error("Clipboard unavailable");
      await clipboard.writeText(code.textContent || "");
      if (disposed || versions.get(button) !== version || !button.isConnected)
        return;
      showState(button, "copied");
    } catch {
      if (disposed || versions.get(button) !== version || !button.isConnected)
        return;
      showState(button, "failed");
    }
    timers.set(
      button,
      setTimeout(() => {
        timers.delete(button);
        showState(button, "idle");
      }, 1500),
    );
  }
  prepare(doc);
  // Only previews add article HTML after startup; don't observe force-graph mutations.
  const preview = doc.querySelector("#preview-content");
  const observer = preview
    ? new MutationObserver(() => {
        for (const button of buttons)
          if (!button.isConnected) {
            clearTimeout(timers.get(button));
            timers.delete(button);
            buttons.delete(button);
          }
        prepare(preview);
      })
    : undefined;
  if (preview) observer?.observe(preview, { childList: true, subtree: true });
  doc.addEventListener("click", copy);
  return {
    destroy() {
      disposed = true;
      doc.removeEventListener("click", copy);
      observer?.disconnect();
      timers.forEach(clearTimeout);
      timers.clear();
      buttons.forEach((button) => button.remove());
      buttons.clear();
    },
  };
}
