import type { Nodes, Text, PhrasingContent } from "mdast";
import type {
  Root as HtmlRoot,
  Element,
  RootContent as HtmlContent,
} from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { inlineTagParts, type InlineTagPart, tagPath } from "../inline-tags";
import { url } from "../site.config";

const literal = new Set([
  "code",
  "inlineCode",
  "math",
  "inlineMath",
  "html",
  "link",
  "linkReference",
  "image",
  "imageReference",
  "definition",
]);
export function sourceText(node: Text, source: string) {
  const start = node.position?.start.offset,
    end = node.position?.end.offset;
  return start !== undefined && end !== undefined
    ? source.slice(start, end)
    : node.value;
}
const literalHTML = new Set([
  "a",
  "code",
  "pre",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea",
  "svg",
  "math",
]);
// Inline raw HTML can enclose Markdown text nodes. Keep those boundaries when
// scanning siblings, rather than turning <code>#literal</code> into a tag.
export function htmlLiteralContexts(children: readonly Nodes[]) {
  const stack: string[] = [];
  return children.map((child) => {
    const protectedText = stack.length > 0;
    if (child.type === "html")
      for (const match of child.value.matchAll(
        /<(\/?)([a-z][\w-]*)\b[^>]*>/gi,
      )) {
        const name = match[2].toLowerCase();
        if (!literalHTML.has(name)) continue;
        if (match[1]) {
          const index = stack.lastIndexOf(name);
          if (index >= 0) stack.splice(index);
        } else if (!match[0].endsWith("/>")) stack.push(name);
      }
    return protectedText;
  });
}
export function rawHTMLTags(source: string, enabled = false) {
  const tree = fromHtml(source, { fragment: true });
  const tags: string[] = [];
  function walk(parent: HtmlRoot | Element) {
    if (parent.type === "element" && literalHTML.has(parent.tagName)) return;
    parent.children = parent.children.flatMap(
      (child: HtmlContent): HtmlContent[] => {
        if (child.type === "element") {
          walk(child);
          return [child];
        }
        if (child.type !== "text") return [child];
        return inlineTagParts(child.value, sourceText(child, source)).map(
          (part): HtmlContent => {
            if (part.tag) tags.push(part.tag);
            return enabled && part.tag
              ? {
                  type: "element",
                  tagName: "a",
                  properties: {
                    href: url(tagPath(part.tag)),
                    className: ["inline-tag"],
                    dataTag: part.tag,
                  },
                  children: [{ type: "text", value: part.text }],
                }
              : { type: "text", value: part.text };
          },
        );
      },
    ) as typeof parent.children;
  }
  walk(tree);
  return { tags, html: enabled && tags.length ? toHtml(tree) : source };
}
export function markdownTags(node: Nodes, source: string): string[] {
  if (node.type === "html") return rawHTMLTags(node.value).tags;
  if (literal.has(node.type)) return [];
  if (node.type === "text")
    return inlineTagParts(node.value, sourceText(node, source)).flatMap(
      (part) => (part.tag ? [part.tag] : []),
    );
  if (!("children" in node)) return [];
  const contexts = htmlLiteralContexts(node.children);
  return node.children.flatMap((child: Nodes, i: number) =>
    contexts[i] ? [] : markdownTags(child, source),
  );
}
export function inlineTagNodes(
  parts: InlineTagPart[],
  enabled = true,
): PhrasingContent[] {
  return parts.map((part): PhrasingContent =>
    enabled && part.tag
      ? {
          type: "link",
          url: url(tagPath(part.tag)),
          data: {
            hProperties: { className: ["inline-tag"], dataTag: part.tag },
          },
          children: [{ type: "text", value: part.text }],
        }
      : { type: "text", value: part.text },
  );
}
export function headingTagParts(
  node: Nodes,
  source: string,
  display: (node: Nodes) => string,
): InlineTagPart[] {
  if (literal.has(node.type)) return [{ text: display(node) }];
  if (node.type === "text")
    return inlineTagParts(node.value, sourceText(node, source)).map((part) =>
      part.tag ? part : { text: display({ ...node, value: part.text }) },
    );
  if (!("children" in node)) return [{ text: display(node) }];
  const contexts = htmlLiteralContexts(node.children);
  return node.children.flatMap((child: Nodes, i: number) =>
    contexts[i]
      ? [{ text: display(child) }]
      : headingTagParts(child, source, display),
  );
}
