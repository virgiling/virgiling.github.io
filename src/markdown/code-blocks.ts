import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

// Before highlighting, retain only the language token from sanitized code.
export function markCodeLanguages() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "pre") return;
      const code = node.children.find(
        (n): n is Element => n.type === "element" && n.tagName === "code",
      );
      const classes = code?.properties.className;
      const language = (Array.isArray(classes) ? classes : [])
        .map(String)
        .find((c) => c.startsWith("language-"))
        ?.slice(9);
      node.properties.dataLanguage = language || "text";
    });
  };
}

// After sanitization/highlighting: fixed, non-executable UI surrounding real code.
export function codeBlockFrames() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      const language = String(node.properties.dataLanguage || "text");
      node.properties.tabIndex = 0;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["code-toolbar"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["code-language"] },
                children: [
                  {
                    type: "text",
                    value:
                      language === "text" || language === "poetry"
                        ? "Plaintext"
                        : language,
                  },
                ],
              },
            ],
          },
          node,
        ],
      };
      return index + 1;
    });
  };
}
