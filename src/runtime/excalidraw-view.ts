import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ExcalidrawComponent } from "@fujocoded/remark-excalidraw/component";
import type { DrawingOptions } from "./excalidraw";
import styles from "../styles/excalidraw.css?inline";

export function mountDrawing(target: HTMLElement, options: DrawingOptions) {
  // Explicitly own deferred styles: Astro can discard side-effect CSS imports
  // in a dynamically imported runtime module. No styles enter the page head.
  const style = target.ownerDocument.createElement("style");
  style.textContent = styles;
  const container = target.ownerDocument.createElement("div");
  target.replaceChildren(style, container);
  const root = createRoot(container);
  root.render(createElement(ExcalidrawComponent, options));
  return () => {
    root.unmount();
    target.replaceChildren();
  };
}
