import { unified } from "unified";
import { randomUUID } from "node:crypto";
import rehypeCitation from "rehype-citation";
import { visit } from "unist-util-visit";
import type { Root as MarkdownRoot, Nodes as MarkdownNode } from "mdast";
import { htmlLiteralContexts } from "./inline-tags";
import { inlineTagParts } from "../inline-tags";
import type { Root, Element, ElementContent, Nodes } from "hast";
import type { InlineCiteNode } from "@benrbray/mdast-util-cite";
import type { Note, Diagnostic } from "../content/types";
import {
  readBibliography,
  labelReferences,
  type Bibliography,
  type Reference,
} from "../content/bibliography";
import { bibliographyStyle } from "./bibliography-style";

const element = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Element["properties"] = {},
): Element => ({ type: "element", tagName, properties, children });
const text = (value: string): ElementContent => ({ type: "text", value });
const textOf = (node: Nodes): string =>
  node.type === "text"
    ? node.value
    : "children" in node
      ? node.children.map(textOf).join("")
      : "";
const hasClass = (node: Element, name: string) =>
  Array.isArray(node.properties.className) &&
  node.properties.className.includes(name);
const escapeRE = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class Citations {
  private library?: Promise<Bibliography>;
  constructor(
    private root: string,
    private diagnostics: Diagnostic[],
  ) {}

  // Only syntax nodes recognized by remark-cite are formatted. No scanning rendered
  // HTML means escaped text, code, math, links and raw HTML cannot turn into citations.
  prepare(markdown: MarkdownRoot, note: Note) {
    const citations: InlineCiteNode[] = [];
    const marker = randomUUID() + ":";
    const mark = (node: MarkdownNode, literal = false) => {
      literal ||= ["link", "linkReference", "image", "imageReference"].includes(
        node.type,
      );
      if (node.type === "cite") {
        node.data.hName = "span";
        node.data.hProperties = literal
          ? {}
          : { dataCitationIndex: marker + (citations.push(node) - 1) };
        node.data.hChildren = [text(node.value)];
      }
      if ("children" in node) {
        const contexts = htmlLiteralContexts(node.children);
        node.children.forEach((child, index) =>
          mark(child, literal || contexts[index]),
        );
      }
    };
    mark(markdown);
    return async (tree: Root) => {
      if (!citations.length) return;
      const library = await (this.library ??= readBibliography(this.root));
      const requests: {
        node: Element;
        citation: InlineCiteNode;
        items: Reference[];
      }[] = [];
      const cited = new Map<string, Reference>();
      visit(tree, "element", (node) => {
        const value = node.properties.dataCitationIndex;
        if (typeof value !== "string" || !value.startsWith(marker)) return;
        const slot = Number(value.slice(marker.length));
        if (!Number.isInteger(slot) || !citations[slot]) return;
        delete node.properties.dataCitationIndex;
        const citation = citations[slot];
        const items = citation.data.citeItems.map((entry) =>
          library.get(entry.key),
        );
        const missing = citation.data.citeItems.filter((_, i) => !items[i]);
        if (missing.length) {
          for (const entry of missing)
            this.diagnostics.push({
              source: note.source,
              code: "unknown-citation",
              message: `Unknown ref.bib key: ${entry.key}`,
            });
          return;
        }
        const known = items.filter((item): item is Reference => !!item);
        for (const item of known) cited.set(item.id, item);
        requests.push({ node, citation, items: known });
      });
      if (!requests.length) return;
      if (cited.size > 500 || requests.length > 3000)
        throw new Error(`Citation budget exceeded: ${note.source}`);
      const records = labelReferences([...cited.values()]);
      const synthetic: Root = {
        type: "root",
        children: requests.map(({ citation, items }) =>
          element("p", [
            text(
              "[" +
                citation.data.citeItems
                  .map(
                    (entry, i) =>
                      `${entry.prefix || ""}@${items[i].id}${(entry.suffix || "").replace(/(\d)[–—](?=\d)/g, "$1-")}`,
                  )
                  .join("; ") +
                "]",
            ),
          ]),
        ),
      };
      const formatted = await unified()
        .use(rehypeCitation, {
          bibliographyData: records,
          csl: bibliographyStyle,
          lang: "en-US",
          linkCitations: false,
        })
        .run(synthetic);
      const bibliography = formatted.children.find(
        (node): node is Element =>
          node.type === "element" && hasClass(node, "references"),
      );
      if (!bibliography)
        throw new Error(`Cannot format citations: ${note.source}`);

      const ids = new Set<string>();
      visit(tree, "element", (node) => {
        if (typeof node.properties.id === "string") ids.add(node.properties.id);
      });
      const unique = (base: string) => {
        let id = base,
          suffix = 1;
        while (ids.has(id)) id = `${base}-${suffix++}`;
        ids.add(id);
        return id;
      };
      const targets = new Map<string, string>();
      for (const record of records)
        targets.set(record.id, unique("ref-" + record.id));
      bibliography.properties = {
        className: ["references"],
        id: unique("references-list"),
      };
      visit(bibliography, "element", (node) => {
        const id = node.properties.id;
        if (typeof id !== "string" || !id.startsWith("bib-")) return;
        const record = records.find((item) => "bib-" + item.id === id);
        if (!record) return;
        node.properties.id = targets.get(record.id)!;
        // The template's conference booktitle is muted italic, not the paper title.
        if (record.type === "paper-conference")
          visit(node, "element", (child) => {
            if (
              child.tagName === "i" &&
              textOf(child) === record["container-title"]
            )
              child.properties.className = ["reference-venue"];
          });
      });
      for (const [index, request] of requests.entries()) {
        const paragraph = formatted.children[index];
        if (paragraph?.type !== "element")
          throw new Error("Missing formatted citation");
        const labels = new Map(
          records
            .filter((record) =>
              request.items.some((item) => item.id === record.id),
            )
            .map((record) => [
              record["citation-label"]!,
              targets.get(record.id)!,
            ]),
        );
        const pattern = new RegExp(
          [...labels.keys()]
            .sort((a, b) => b.length - a.length)
            .map(escapeRE)
            .join("|"),
          "gu",
        );
        visit(paragraph, "element", (node) => {
          delete node.properties.id;
        });
        visit(paragraph, "text", (node, index, parent) => {
          if (!parent || index === undefined) return;
          const children: ElementContent[] = [];
          let cursor = 0;
          for (const match of node.value.matchAll(pattern)) {
            if (match.index > cursor)
              children.push(text(node.value.slice(cursor, match.index)));
            children.push(
              element("a", [text(match[0])], {
                href: "#" + labels.get(match[0])!,
                ariaLabel: `Reference ${match[0]}`,
              }),
            );
            cursor = match.index + match[0].length;
          }
          if (!cursor) return;
          if (cursor < node.value.length)
            children.push(text(node.value.slice(cursor)));
          parent.children.splice(index, 1, ...children);
          return index + children.length;
        });
        request.node.properties = { className: ["citation"] };
        request.node.children = paragraph.children;
      }
      visit(tree, "element", (node) => {
        if (!/^h[1-6]$/.test(node.tagName)) return;
        const heading = note.headings.find(
          (item) => item.id === node.properties.id,
        );
        if (!heading) return;
        let hasCitation = false;
        visit(node, "element", (child) => {
          if (hasClass(child, "citation")) hasCitation = true;
        });
        if (hasCitation) {
          heading.text = textOf(node);
          heading.parts = inlineTagParts(heading.text);
        }
      });
      // Reuse a terminal authored References heading; never reuse a transcluded one.
      const headings = tree.children.filter(
        (node): node is Element =>
          node.type === "element" && /^h[1-6]$/.test(node.tagName),
      );
      const last = headings.at(-1);
      const appendix: Element[] = [];
      if (!(
        last?.tagName === "h2" &&
        /^references$/i.test(textOf(last).trim()) &&
        note.headings.some((heading) => heading.id === last.properties.id)
      )) {
        const id = unique("references");
        appendix.push(element("h2", [text("References")], { id }));
        note.headings.push({
          id,
          text: "References",
          depth: 2,
          trail: ["References"],
        });
      }
      // Bibliography precedes the existing footnote section, retaining footnote IDs.
      const footnotes = tree.children.findIndex(
        (node) =>
          node.type === "element" &&
          node.tagName === "section" &&
          Object.hasOwn(node.properties, "dataFootnotes"),
      );
      appendix.push(bibliography);
      tree.children.splice(
        footnotes < 0 ? tree.children.length : footnotes,
        0,
        ...appendix,
      );
    };
  }
}
