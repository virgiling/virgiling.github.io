import { unified } from "unified";
import toHast from "remark-rehype";
import raw from "rehype-raw";
import sanitize, { defaultSchema } from "rehype-sanitize";
import stringify from "rehype-stringify";
import mathjax from "rehype-mathjax/svg";
import shiki from "@shikijs/rehype";
import { visit } from "unist-util-visit";
import { rehypeCallouts } from "../markdown/callouts";
import { rehypeFigures } from "../markdown/figures";
import { codeBlockFrames } from "../markdown/code-blocks";
import { textOf } from "./parse";
import { url } from "../site.config";
import type { Citations } from "../markdown/citations";
import type { Note, Asset } from "./types";

const t = (value: string) => ({ type: "text", value });
const pinIcon = () => ({
  type: "element",
  tagName: "svg",
  properties: {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ariaHidden: "true",
    focusable: "false",
  },
  children: [
    {
      type: "element",
      tagName: "path",
      properties: { d: "M8 3h8M9 3v6l-3 4v2h12v-2l-3-4V3M12 15v6" },
      children: [],
    },
  ],
});
const schema: any = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [
    ...defaultSchema.tagNames!,
    "mark",
    "aside",
    "figure",
    "figcaption",
    "details",
    "summary",
    "audio",
    "video",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] || []),
      "className",
      "id",
      "lang",
    ],
    a: [
      ...(defaultSchema.attributes?.a || []).filter(
        (attribute) =>
          typeof attribute === "string" || attribute[0] !== "className",
      ),
      ["className", "data-footnote-backref", "inline-tag"],
      "dataPreview",
      "dataTag",
    ],
    blockquote: [["dataCalloutMarker", "1"], "className"],
    audio: ["src", "controls", "preload"],
    video: ["src", "controls", "preload"],
    img: [
      ...(defaultSchema.attributes?.img || []),
      "width",
      "height",
      "loading",
    ],
    code: [["className", /^language-./]],
    input: [...(defaultSchema.attributes?.input || []), "ariaLabel"],
  },
};

export interface RenderContext {
  notes: Note[];
  assets: Map<string, Asset>;
  tagURLs: Set<string>;
  citations: Citations;
}

export async function renderNote(
  note: Note,
  tree: any,
  context: RenderContext,
) {
  const renderCitations = context.citations.prepare(tree, note);
  const processor = unified()
    .use(toHast, {
      allowDangerousHtml: true,
      clobberPrefix: "fn-",
      footnoteLabel: "脚注",
      footnoteBackLabel: "返回正文",
    })
    .use(raw)
    .use(() => renderCitations)
    .use(() => (tree: any) => {
      visit(tree, "element", (n: any) => {
        if (
          n.tagName === "div" &&
          String(n.properties.style).includes("Biro")
        ) {
          n.properties = { className: ["welcome-note"] };
          n.children
            .filter((c: any) => c.tagName === "span")
            .forEach(
              (s: any, i: number) =>
                (s.properties = {
                  className: [i ? "welcome-label" : "welcome-quote"],
                }),
            );
        }
      });
    })
    .use(sanitize, schema)
    .use(rehypeCallouts)
    .use(rehypeFigures)
    .use(() => (tree: any) => {
      visit(tree, "element", (node: any, index, parent: any) => {
        if (node.tagName !== "pre" || !parent || index === undefined) return;
        const code = node.children.find((n: any) => n.tagName === "code"),
          id = node.properties.id || code?.properties?.id;
        if (!id) return;
        delete node.properties.id;
        if (code) delete code.properties.id;
        parent.children.splice(index, 0, {
          type: "element",
          tagName: "span",
          properties: { id },
          children: [],
        });
        return index + 2;
      });
    })
    .use(shiki, {
      theme: "catppuccin-latte",
      fallbackLanguage: "text",
    })
    .use(mathjax)
    .use(() => (tree: any) => {
      visit(tree, "element", (n: any, index, parent: any) => {
        if (n.tagName === "input") {
          n.properties.disabled = true;
          n.properties.ariaLabel = "任务状态（只读）";
        }
        if (n.tagName === "pre") n.properties.tabIndex = 0;
        if (n.tagName === "img") {
          const source = n.properties.src;
          if (
            (typeof source !== "string" ||
              (!/^https?:\/\//i.test(source) &&
                ![...context.assets.values()].some(
                  (asset) =>
                    source === asset.url || source.startsWith(asset.url + "#"),
                ))) &&
            parent &&
            index !== undefined
          ) {
            parent.children.splice(index, 1);
            return index;
          }
          n.properties.loading = "lazy";
        }
        if (/^h[1-6]$/.test(n.tagName) && n.properties.id) {
          n.children.push({
            type: "element",
            tagName: "a",
            properties: {
              className: ["heading-anchor"],
              href: "#" + encodeURIComponent(n.properties.id),
              ariaLabel: "链接到 " + textOf(n),
            },
            children: [t("#")],
          });
        }
        // Authored raw HTML cannot bypass the document/attachment resolver.
        if (["a", "img", "audio", "video"].includes(n.tagName)) {
          const attr = n.tagName === "a" ? "href" : "src",
            value = n.properties[attr];
          if (
            typeof value === "string" &&
            !/^(?:https?:\/\/|mailto:|#)/i.test(value) &&
            !context.notes.some(
              (x) => value === x.url || value.startsWith(x.url + "#"),
            ) &&
            ![...context.assets.values()].some(
              (x) => value === x.url || value.startsWith(x.url + "#"),
            ) &&
            !context.tagURLs.has(value) &&
            value !== url("404")
          ) {
            if (n.tagName === "a") n.properties.href = url("404");
            else delete n.properties[attr];
          }
        }
        const missing = n.properties.href === url("404");
        if (
          n.tagName === "a" &&
          (n.properties.dataPreview || missing) &&
          textOf(n)
            .replace(/[\u200B\uFEFF]/g, "")
            .trim() &&
          n.properties.href !== note.url &&
          !n.properties.className?.includes("preview-button") &&
          parent &&
          index !== undefined
        ) {
          parent.children.splice(index + 1, 0, {
            type: "element",
            tagName: missing ? "a" : "button",
            properties: {
              className: ["preview-button"],
              ...(missing
                ? {
                    href: url("404"),
                    ariaLabel: "打开未找到页面：" + textOf(n),
                  }
                : {
                    type: "button",
                    dataOpenPreview: n.properties.dataPreview,
                    ariaLabel: "固定预览：" + textOf(n),
                    ariaHasPopup: "dialog",
                    ariaControls: "note-preview",
                  }),
            },
            children: [pinIcon()],
          });
        }
      });
    })
    .use(stringify);
  const hast = await processor.run(tree);
  note.readingText = textOf(hast);
  codeBlockFrames()(hast);
  note.html = processor.stringify(hast);
}
