export function initCodeCopy(
  doc: Document = document,
  clipboard: Pick<Clipboard, "writeText"> | undefined = navigator.clipboard,
) {
  let disposed = false;
  const buttons = new Set<HTMLButtonElement>();
  const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  const versions = new WeakMap<HTMLButtonElement, number>();
  function prepare(root: ParentNode) {
    root.querySelectorAll<HTMLElement>(".code-block").forEach((block) => {
      const toolbar = block.querySelector(".code-toolbar");
      if (!toolbar || toolbar.querySelector(".copy-code")) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = "复制";
      button.setAttribute("aria-label", "复制代码");
      button.setAttribute("aria-live", "polite");
      toolbar.append(button);
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
      button.textContent = "已复制";
      button.setAttribute("aria-label", "代码已复制");
    } catch {
      if (disposed || versions.get(button) !== version || !button.isConnected)
        return;
      button.textContent = "复制失败，请手动选择";
      button.setAttribute("aria-label", "复制失败，请手动选择代码");
    }
    timers.set(
      button,
      setTimeout(() => {
        timers.delete(button);
        button.textContent = "复制";
        button.setAttribute("aria-label", "复制代码");
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
