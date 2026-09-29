import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { visitParents } from "unist-util-visit-parents";

function positiveSize(value: unknown) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 1 ? Math.floor(size) : undefined;
}

// These are display bounds, not intrinsic dimensions or resize requests.
// The browser reads the original image and preserves its natural aspect ratio.
export function articleImages(html: string): string {
  if (!/<img\b/i.test(html)) return html;
  const tree = fromHtml(html, { fragment: true });
  visitParents(tree, "element", (node: any, ancestors: any[]) => {
    if (node.tagName !== "img") return;
    const p = node.properties;
    const original = String(p.src || "");
    if (!original) return;

    const suffix = /\|(\d{1,4})(?:x(\d{1,4}))?$/.exec(String(p.alt || ""));
    if (suffix) {
      p.alt = String(p.alt).slice(0, suffix.index);
      p.width = suffix[1];
      if (suffix[2]) p.height = suffix[2];
    }
    const width = positiveSize(p.width);
    const height = positiveSize(p.height);
    const bounds: string[] = [];
    if (width) {
      p.width = width;
      bounds.push(`--image-width:${width}px`);
    } else delete p.width;
    if (height) {
      p.height = height;
      bounds.push(`--image-height:${height}px`);
    } else delete p.height;
    if (bounds.length) {
      p.dataImageSized = "";
      p.style = bounds.join(";");
    }
    p.loading = "lazy";
    p.decoding = "async";

    // No fetch, metadata probe, proxy, format conversion or generated srcset.
    // Keep authored links intact; unlinked images have a native original-image fallback.
    if (ancestors.some((ancestor) => ancestor.tagName === "a")) return;
    const parent = ancestors.at(-1);
    const index = parent.children.indexOf(node);
    parent.children[index] = {
      type: "element",
      tagName: "a",
      properties: {
        href: original,
        className: ["image-zoom-link"],
        dataImageZoom: "",
        ariaLabel: p.alt ? `放大图片：${p.alt}` : "放大图片",
      },
      children: [node],
    };
  });
  return toHtml(tree);
}
