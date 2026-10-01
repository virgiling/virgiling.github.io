// Leaflet CSS is an explicit URL asset, loaded only by the visible-map owner.
export function loadMapStyles(
  doc: Document,
  url: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Map styles canceled"));
      return;
    }
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    const clear = () => {
      link.removeEventListener("load", loaded);
      link.removeEventListener("error", failed);
    };
    const remove = (error: Error) => {
      clear();
      link.remove();
      signal.removeEventListener("abort", abort);
      reject(error);
    };
    const abort = () => remove(new Error("Map styles canceled"));
    const loaded = () => {
      clear();
      resolve();
    };
    const failed = () => remove(new Error("Map styles failed"));
    link.addEventListener("load", loaded);
    link.addEventListener("error", failed);
    signal.addEventListener("abort", abort, { once: true });
    doc.head.append(link);
  });
}
