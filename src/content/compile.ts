import { unified } from "unified";
import parse from "remark-parse";
import gfm from "remark-gfm";
import math from "remark-math";
import toHast from "remark-rehype";
import raw from "rehype-raw";
import sanitize, { defaultSchema } from "rehype-sanitize";
import stringify from "rehype-stringify";
import mathjax from "rehype-mathjax/svg";
import shiki from "@shikijs/rehype";
import { visit } from "unist-util-visit";
import GithubSlugger from "github-slugger";
import { posix } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { remarkCallouts, rehypeCallouts } from "../markdown/callouts.mjs";
import { rehypeFigures } from "../markdown/figures.mjs";
import { contentFile } from "./read";
import { url } from "../site.config";
import { Resolver } from "./resolve";
import type { Note, Asset, Diagnostic } from "./types";

const parser = unified().use(parse).use(gfm).use(math);
export const textOf = (node: any): string =>
  node.type === "html"
    ? ""
    : (node.value ?? (node.children || []).map(textOf).join(""));
// Comments are removed before indexing, while code/HTML/math retain literal syntax.
export function withoutComments(source: string) {
  const tree = parser.parse(source),
    protectedRanges: [number, number][] = [];
  visit(tree, (n: any) => {
    if (
      ["code", "inlineCode", "html", "math", "inlineMath"].includes(n.type) &&
      n.position
    )
      protectedRanges.push([n.position.start.offset, n.position.end.offset]);
  });
  let out = "",
    cursor = 0,
    start = -1;
  for (let i = 0; i < source.length - 1; i++) {
    if (source.slice(i, i + 2) !== "%%" || source[i - 1] === "\\") continue;
    if (protectedRanges.some(([a, b]) => i >= a && i < b)) continue;
    if (start < 0) {
      out += source.slice(cursor, i);
      start = i;
    } else {
      cursor = i + 2;
      start = -1;
    }
    i++;
  }
  return out + (start < 0 ? source.slice(cursor) : "");
}
export function parseNote(note: Note) {
  note.body = withoutComments(note.body);
  note.tree = parser.parse(note.body);
  remarkCallouts({ source: note.body })(note.tree);
  const slugs = new GithubSlugger(),
    trail: string[] = [];
  visit(note.tree, "heading", (n: any) => {
    const text = textOf(n),
      id = slugs.slug(text);
    trail.length = n.depth - 1;
    trail[n.depth - 1] = text;
    n.data = { ...n.data, hProperties: { id } };
    note.headings.push({
      id,
      text,
      depth: n.depth,
      trail: trail.filter(Boolean),
    });
  });
  // Top-level block IDs, including a standalone marker after lists/tables.
  note.tree.children.forEach((n: any, i: number) => {
    const last = n.children?.at(-1);
    if (last?.type !== "text") return;
    const match = /(?:^|\s)\^([\w-]+)\s*$/.exec(last.value);
    if (!match) return;
    const standalone = textOf(n).trim() === `^${match[1]}`,
      target = standalone ? note.tree.children[i - 1] : n;
    if (!target) return;
    if (note.blocks.has(match[1]))
      throw new Error(`Duplicate block ID in ${note.source}`);
    last.value = last.value.slice(0, match.index);
    target.data = {
      ...target.data,
      hProperties: { ...target.data?.hProperties, id: "block-" + match[1] },
    };
    note.blocks.set(match[1], standalone ? i - 1 : i);
  });
}
const t = (value: string) => ({ type: "text", value });
const unavailable = () => ({ type: "text", value: "该内容未公开或不可用" });
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
const mediaTypes = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".mp4",
  ".webm",
  ".pdf",
]);
export class Compiler {
  assets = new Map<string, Asset>();
  resolver: Resolver;
  constructor(
    public root: string,
    public notes: Note[],
    public files: Set<string>,
    public diagnostics: Diagnostic[],
  ) {
    this.resolver = new Resolver(notes, diagnostics);
  }
  async asset(from: Note, target: string) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(target.split("#")[0]);
    } catch {
      return undefined;
    }
    if (
      decoded.includes("\\") ||
      decoded.startsWith("/") ||
      /^[a-z][\w+.-]*:/i.test(decoded)
    )
      return undefined;
    const ext = posix.extname(decoded).toLowerCase();
    if (!mediaTypes.has(ext)) return undefined;
    const relative = posix.normalize(
      posix.join(posix.dirname(from.source), decoded),
    );
    let source = [relative, decoded].find(
      (path) => !path.startsWith("../") && this.files.has(path),
    );
    if (!source && !decoded.includes("/")) {
      const candidates = [...this.files].filter(
        (f) => posix.basename(f) === decoded,
      );
      if (candidates.length === 1) source = candidates[0];
    }
    if (!source) return undefined;
    if (!this.assets.has(source)) {
      const buffer = await readFile(await contentFile(this.root, source));
      const name =
        createHash("sha256").update(buffer).digest("hex").slice(0, 24) + ext;
      this.assets.set(source, {
        source,
        output: name,
        url: url("media/" + name),
      });
    }
    return this.assets.get(source);
  }
  async compile(note: Note) {
    let serial = 0,
      budget = 0;
    const walk = async (
      node: any,
      owner: Note,
      chain: string[],
      record: boolean,
    ): Promise<any> => {
      if (++budget > 40000)
        throw new Error(`Transclusion budget exceeded: ${note.source}`);
      if (node.type === "code") {
        if (node.lang === "poetry") return { ...node, lang: "text" };
        if (
          ["base", "query", "dataview", "dataviewjs", "mermaid"].includes(
            node.lang,
          )
        ) {
          this.resolver.warn(
            owner,
            "unsupported-fence",
            `${node.lang} is not evaluated in this milestone`,
          );
          return {
            type: "blockquote",
            children: [
              {
                type: "paragraph",
                children: [t(`${node.lang} 视图暂不支持。`)],
              },
            ],
          };
        }
      }
      if (node.type === "text") {
        const children: any[] = [];
        let cursor = 0;
        const pattern =
          /(!?)\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|==([^=\n]+)==|\^\[([^\]\n]+)\]/g;
        for (const match of node.value.matchAll(pattern)) {
          children.push(t(node.value.slice(cursor, match.index)));
          cursor = match.index + match[0].length;
          if (match[4]) {
            children.push({
              type: "emphasis",
              data: { hName: "mark" },
              children: [t(match[4])],
            });
            continue;
          }
          if (match[5]) {
            const id = `inline-${++serial}`;
            footnotes.push({
              type: "footnoteDefinition",
              identifier: id,
              children: [{ type: "paragraph", children: [t(match[5])] }],
            });
            children.push({ type: "footnoteReference", identifier: id });
            continue;
          }
          const embedded = !!match[1],
            target = match[2],
            label = match[3] || target.split("#")[0] || target;
          const asset = await this.asset(owner, target);
          if (asset) {
            if (embedded) {
              const size = /^(\d{1,4})(?:x(\d{1,4}))?$/.exec(match[3] || "");
              const ext = posix.extname(asset.output);
              if (
                [".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm"].includes(ext)
              )
                children.push({
                  type: "text",
                  value: "",
                  data: {
                    hName: [".mp4", ".webm"].includes(ext) ? "video" : "audio",
                    hProperties: {
                      src: asset.url,
                      controls: true,
                      preload: "none",
                    },
                  },
                });
              else if (ext === ".pdf")
                children.push({
                  type: "link",
                  url:
                    asset.url +
                    (/^.*#page=\d+$/.test(target)
                      ? "#" + target.split("#")[1]
                      : ""),
                  children: [t(label + "（PDF）")],
                });
              else
                children.push({
                  type: "image",
                  url: asset.url,
                  alt: size ? "" : label,
                  data: {
                    hProperties: size
                      ? {
                          width: Number(size[1]),
                          ...(size[2] ? { height: Number(size[2]) } : {}),
                        }
                      : {},
                  },
                });
            } else
              children.push({
                type: "link",
                url: asset.url,
                children: [t(label)],
              });
            continue;
          }
          const result = this.resolver.resolve(owner, target, {
            embed: embedded,
          });
          if (!result) {
            children.push(unavailable());
            continue;
          }
          if (record && !note.links.includes(result.note.id))
            note.links.push(result.note.id);
          if (!embedded) {
            children.push({
              type: "link",
              url: result.href,
              data: {
                hProperties: result.note.unlisted
                  ? {}
                  : { dataPreview: result.note.id },
              },
              children: [t(label)],
            });
            continue;
          }
          if (chain.includes(result.note.id) || chain.length >= 5) {
            children.push(t("嵌入已停止：循环引用或超出深度限制。"));
            this.resolver.warn(
              owner,
              "embed-cycle",
              "Transclusion cycle/depth guard",
            );
            continue;
          }
          const copy = structuredClone(result.note.tree);
          let selected: any[] = copy.children;
          if (result.anchor.startsWith("block-"))
            selected = [
              copy.children[result.note.blocks.get(result.anchor.slice(6))!],
            ];
          else if (result.anchor) {
            const start = copy.children.findIndex(
                (n: any) =>
                  n.type === "heading" &&
                  n.data?.hProperties?.id === result.anchor,
              ),
              depth = (copy.children[start] as any)?.depth;
            let end = start + 1;
            while (
              end < copy.children.length &&
              !(
                copy.children[end].type === "heading" &&
                (copy.children[end] as any).depth <= depth
              )
            )
              end++;
            selected = copy.children.slice(start, end);
          }
          // Definitions are document-scoped; carry them alongside selected sections.
          const defs = copy.children.filter(
            (n) => n.type === "definition" || n.type === "footnoteDefinition",
          );
          selected = [...new Set([...selected, ...defs])];
          const scope = `embed-${++serial}-`;
          for (const child of selected)
            visit(child, (n: any) => {
              if (n.data?.hProperties?.id)
                n.data.hProperties.id = scope + n.data.hProperties.id;
              if (
                [
                  "footnoteDefinition",
                  "footnoteReference",
                  "definition",
                  "linkReference",
                  "imageReference",
                ].includes(n.type)
              )
                n.identifier = scope + n.identifier;
            });
          const content = await Promise.all(
            selected.map((n) =>
              walk(n, result.note, [...chain, result.note.id], false),
            ),
          );
          children.push({
            type: "blockquote",
            data: { hProperties: { className: ["note-embed"] } },
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    url: result.href,
                    children: [t(result.note.title)],
                  },
                ],
              },
              ...content,
            ],
          });
        }
        if (!cursor) return node;
        children.push(t(node.value.slice(cursor)));
        return { type: "fragment", children };
      }
      if (["link", "image", "definition"].includes(node.type)) {
        if (
          /^https?:\/\//i.test(node.url) ||
          (/^mailto:/i.test(node.url) && node.type !== "image")
        )
          return node;
        // Embedded nodes already carry absolute, base-aware generated URLs.
        if (node.url?.startsWith(url("media/"))) return node;
        const asset = await this.asset(owner, node.url);
        if (asset) {
          node.url = asset.url;
        } else if (node.type === "image") {
          this.resolver.warn(
            owner,
            "unavailable-asset",
            "Image is not in the allowed asset set",
          );
          return unavailable();
        } else {
          const result = this.resolver.resolve(owner, node.url);
          if (!result)
            return node.type === "definition"
              ? { ...node, url: "#unavailable" }
              : { type: "text", value: textOf(node) || "该内容未公开或不可用" };
          node.url = result.href;
          if (record && !note.links.includes(result.note.id))
            note.links.push(result.note.id);
          if (node.type === "link" && !result.note.unlisted)
            node.data = {
              ...node.data,
              hProperties: {
                ...node.data?.hProperties,
                dataPreview: result.note.id,
              },
            };
        }
      }
      if (node.children) {
        node.children = (
          await Promise.all(
            node.children.map((n: any) => walk(n, owner, chain, record)),
          )
        ).flatMap((n) => (n.type === "fragment" ? n.children : [n]));
        // Transclusions are block nodes, never invalid blockquotes inside a paragraph.
        if (
          node.type === "paragraph" &&
          node.children.some((n: any) => n.type === "blockquote")
        ) {
          const parts: any[] = [];
          let inline: any[] = [];
          for (const child of node.children) {
            if (child.type === "blockquote") {
              if (inline.length)
                parts.push({ type: "paragraph", children: inline });
              inline = [];
              parts.push(child);
            } else inline.push(child);
          }
          if (inline.length)
            parts.push({ type: "paragraph", children: inline });
          return { type: "fragment", children: parts };
        }
      }
      return node;
    };
    const footnotes: any[] = [];
    const tree = await walk(structuredClone(note.tree), note, [note.id], true);
    tree.children.push(...footnotes);
    // Search excludes transcluded text; private comments were removed before parsing.
    note.plainText = note.tree.children
      .filter((n) => n.type !== "html")
      .map(textOf)
      .join("\n")
      .replace(/!?\[\[[^\]]+\]\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    note.summary =
      note.description ||
      note.plainText
        .split(/(?<=[。！？])\s*|(?<=[.!?])\s+(?=[A-Z\p{Script=Han}])/u)[0]
        ?.slice(0, 240) ||
      note.title;
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
        a: [...(defaultSchema.attributes?.a || []), "dataPreview"],
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
    const processor = unified()
      .use(toHast, {
        allowDangerousHtml: true,
        clobberPrefix: "fn-",
        footnoteLabel: "脚注",
        footnoteBackLabel: "返回正文",
      })
      .use(raw)
      .use(() => (tree) => {
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
      .use(() => (tree) => {
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
      .use(shiki, { theme: "catppuccin-latte", fallbackLanguage: "text" })
      .use(mathjax)
      .use(() => (tree) => {
        visit(tree, "element", (n: any, index, parent: any) => {
          if (
            n.tagName === "a" &&
            n.properties.dataPreview &&
            parent &&
            index !== undefined
          ) {
            parent.children.splice(index + 1, 0, {
              type: "element",
              tagName: "button",
              properties: {
                type: "button",
                className: ["preview-button"],
                dataOpenPreview: n.properties.dataPreview,
                ariaLabel: "固定预览：" + textOf(n),
                ariaHasPopup: "dialog",
                ariaControls: "note-preview",
              },
              children: [pinIcon()],
            });
          }
          if (n.tagName === "a" && n.properties.href === "#unavailable") {
            n.tagName = "span";
            delete n.properties.href;
          }
          if (n.tagName === "input") {
            n.properties.disabled = true;
            n.properties.ariaLabel = "任务状态（只读）";
          }
          if (n.tagName === "pre") n.properties.tabIndex = 0;
          if (n.tagName === "img") n.properties.loading = "lazy";
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
              !this.notes.some(
                (x) => value === x.url || value.startsWith(x.url + "#"),
              ) &&
              ![...this.assets.values()].some(
                (x) => value === x.url || value.startsWith(x.url + "#"),
              )
            )
              delete n.properties[attr];
          }
        });
      })
      .use(stringify);
    const hast = await processor.run(tree);
    note.readingText = textOf(hast);
    note.html = processor.stringify(hast);
    return note;
  }
}
