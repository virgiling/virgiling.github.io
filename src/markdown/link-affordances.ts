import type { Root } from "hast";
import { SKIP, visit } from "unist-util-visit";
import { textOf } from "../content/parse";

/** Mark prose links without changing authored labels or navigation behavior. */
export function linkAffordances(site: string) {
  const origin = new URL(site).origin;
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "svg") return SKIP;
      const href = node.properties.href;
      if (
        node.tagName !== "a" ||
        typeof href !== "string" ||
        !textOf(node).trim()
      )
        return;
      const classes = Array.isArray(node.properties.className)
        ? node.properties.className
        : [];
      if (
        classes.some((name) =>
          [
            "heading-anchor",
            "tag",
            "inline-tag",
            "data-footnote-backref",
          ].includes(String(name)),
        ) ||
        node.properties.dataFootnoteRef !== undefined ||
        node.properties.dataFootnoteBackref !== undefined
      )
        return;
      let target: URL;
      try {
        target = new URL(href, site);
      } catch {
        return;
      }
      if (!["http:", "https:"].includes(target.protocol)) return;
      if (target.origin === origin) {
        node.properties.className = [...classes, "internal-link"];
      } else {
        // The glyph lives in CSS: reading text, summaries and copied labels stay intact.
        node.children.push({
          type: "element",
          tagName: "span",
          properties: { className: ["external-link-mark"], ariaHidden: "true" },
          children: [],
        });
      }
    });
  };
}
