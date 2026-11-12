import { Buffer } from "node:buffer";
import type { Element, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import mathjax, { type Options } from "rehype-mathjax/svg";
import sanitize from "rehype-sanitize";
import { unified } from "unified";

// Obsidian stores equation source separately from the scene's image elements.
// Both the current and legacy Embedded Files headings are supported.
export function drawingFormulas(source: string): Map<string, string> {
  const heading = /^#{1,2} Embedded [Ff]iles[ \t]*\r?$/m.exec(source);
  if (!heading) return new Map();
  const section = source
    .slice(heading.index + heading[0].length)
    .split(/^#{1,6} |^%%[ \t]*\r?$/m, 1)[0];
  return new Map(
    [
      ...section.matchAll(
        /^([\w-]+):[ \t]*\$\$([\s\S]*?)\$\$[ \t]*(?:\r?\n|$)/gm,
      ),
    ].map((match) => [match[1], match[2].trim()]),
  );
}

const renderer = unified().use<[Options], Root>(mathjax, {
  svg: { fontCache: "none" },
  tex: {
    formatError() {
      throw new Error("Invalid drawing formula");
    },
  },
});
// Keep generated math geometry, not MathJax page CSS or TeX-authored links.
// This does not allow arbitrary source SVG files through the drawing boundary.
const color = /^(?:#[\da-f]{3,8}|[a-z]+)$/i;
const geometry = unified().use(sanitize, {
  tagNames: ["svg", "g", "path", "rect", "line", "polyline", "polygon", "text"],
  attributes: {
    "*": [
      "transform",
      ["fill", color],
      ["stroke", color],
      "stroke-width",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "opacity",
    ],
    svg: ["xmlns", "viewBox", "width", "height", "color"],
    path: ["d"],
    rect: ["x", "y", "width", "height", "rx", "ry"],
    line: ["x1", "y1", "x2", "y2"],
    polyline: ["points"],
    polygon: ["points"],
    text: ["x", "y", "dx", "dy", "font-size", "font-family"],
  },
});

export function formulaImage(latex: string) {
  const input: Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "code",
        properties: { className: ["math-display"] },
        children: [{ type: "text", value: latex }],
      },
    ],
  };
  const tree = renderer.runSync(input);
  const container = tree.children.find(
    (node): node is Element =>
      node.type === "element" && node.tagName === "mjx-container",
  );
  const svg = container?.children.find(
    (node): node is Element =>
      node.type === "element" && node.tagName === "svg",
  );
  if (!svg || typeof svg.properties.viewBox !== "string")
    throw new Error("Invalid drawing formula");
  const bounds = svg.properties.viewBox.split(/\s+/).map(Number);
  if (
    bounds.length !== 4 ||
    !bounds.every(Number.isFinite) ||
    bounds[2] <= 0 ||
    bounds[3] <= 0
  )
    throw new Error("Invalid drawing formula bounds");
  // Give the standalone image numeric intrinsic dimensions at 16px/em.
  // Excalidraw still controls its displayed position, size, rotation and crop.
  svg.properties.width = bounds[2] * 0.016;
  svg.properties.height = bounds[3] * 0.016;
  svg.properties.color = "#000000";
  const clean = geometry.runSync({ type: "root", children: [svg] });
  const content = toHtml(clean, { space: "svg", closeEmptyElements: true });
  return {
    mimeType: "image/svg+xml",
    dataURL:
      "data:image/svg+xml;base64," + Buffer.from(content).toString("base64"),
  };
}
