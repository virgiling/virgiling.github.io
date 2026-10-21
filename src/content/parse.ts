import { unified } from "unified";
import parse from "remark-parse";
import gfm from "remark-gfm";
import math from "remark-math";
import cite from "@benrbray/remark-cite";
import { visit } from "unist-util-visit";
import GithubSlugger from "github-slugger";
import { remarkCallouts } from "../markdown/callouts";
import { markdownTags, headingTagParts } from "../markdown/inline-tags";
import { inlineTagParts } from "../inline-tags";
import type { Note } from "./types";

const parser = unified().use(parse).use(gfm).use(math).use(cite);
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
export const wikiLabel = (target: string, alias?: string) =>
  alias || target.split("#")[0] || target;
// Match rendered link labels, but keep code/math literal and old heading IDs stable.
function headingText(node: any): string {
  if (node.type === "text")
    return node.value.replace(
      /!?\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
      (_: string, target: string, alias?: string) => wikiLabel(target, alias),
    );
  if (node.type === "html") return "";
  return node.value ?? (node.children || []).map(headingText).join("");
}
export function parseNote(note: Note) {
  note.body = withoutComments(note.body);
  note.tree = parser.parse(note.body);
  remarkCallouts({ source: note.body })(note.tree);
  note.tagMentions = [
    ...new Set([
      ...inlineTagParts(note.title).flatMap((part) =>
        part.tag ? [part.tag] : [],
      ),
      ...inlineTagParts(note.description).flatMap((part) =>
        part.tag ? [part.tag] : [],
      ),
      ...markdownTags(note.tree, note.body),
    ]),
  ];
  const slugs = new GithubSlugger(),
    trail: string[] = [];
  visit(note.tree, "heading", (n: any) => {
    const text = headingText(n),
      id = slugs.slug(textOf(n));
    trail.length = n.depth - 1;
    trail[n.depth - 1] = text;
    n.data = { ...n.data, hProperties: { id } };
    note.headings.push({
      id,
      text,
      parts: headingTagParts(n, note.body, headingText),
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
