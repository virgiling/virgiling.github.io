import type { Root } from "hast";
import { visit } from "unist-util-visit";

// A transparent positioning container keeps the copy control outside the
// horizontally scrolling pre. It adds no toolbar or visual frame.
export function codeBlockFrames() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block"] },
        children: [node],
      };
      return index + 1;
    });
  };
}
