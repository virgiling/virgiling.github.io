import { constants } from "node:fs";
import { open, realpath, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import { fromHtml } from "hast-util-from-html";
import type { Nodes } from "hast";

interface Name {
  family?: string;
  given?: string;
  literal?: string;
  "non-dropping-particle"?: string;
  suffix?: string;
}
export interface Reference {
  id: string;
  type: string;
  title: string;
  author?: Name[];
  editor?: Name[];
  issued?: { "date-parts": number[][] };
  "citation-label"?: string;
  [field: string]: string | Name[] | { "date-parts": number[][] } | undefined;
}
export type Bibliography = Map<string, Reference>;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
// BibTeX rich text must not introduce HTML, links, images, or private fields.
function plain(node: Nodes): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" && ["script", "style"].includes(node.tagName))
    return "";
  return "children" in node ? node.children.map(plain).join("") : "";
}
const text = (value: unknown) =>
  typeof value === "string" ? plain(fromHtml(value, { fragment: true })) : "";
function names(value: unknown): Name[] | undefined {
  if (!Array.isArray(value)) return;
  const result = value
    .map((entry) => {
      const name = object(entry),
        out: Name = {};
      for (const key of [
        "family",
        "given",
        "literal",
        "non-dropping-particle",
        "suffix",
      ] as const) {
        const value = text(name[key]);
        if (value) out[key] = value;
      }
      return out;
    })
    .filter((name) => name.family || name.literal);
  return result.length ? result : undefined;
}
export function parseBibliography(source: string): Bibliography {
  const records = new Cite(source, {
    generateGraph: false,
    forceType: "@biblatex/text",
  }).data;
  if (records.length > 10000) throw new Error("ref.bib exceeds 10000 entries");
  const result: Bibliography = new Map();
  for (const value of records) {
    const data = object(value),
      key = data.id;
    if (typeof key !== "string" || !key)
      throw new Error("Invalid ref.bib citation key");
    if (result.has(key))
      throw new Error(`Duplicate ref.bib citation key: ${key}`);
    const item: Reference = {
      id: "r" + createHash("sha256").update(key).digest("hex").slice(0, 24),
      type: text(data.type) || "article",
      title: text(data.title),
      author: names(data.author),
      editor: names(data.editor),
    };
    for (const field of [
      "container-title",
      "publisher",
      "publisher-place",
      "edition",
      "volume",
      "issue",
      "page",
      "collection-title",
      "number",
      "genre",
    ])
      if (typeof data[field] === "string" || typeof data[field] === "number")
        item[field] = text(String(data[field]));
    const parts = object(data.issued)["date-parts"];
    if (Array.isArray(parts) && Array.isArray(parts[0])) {
      const date = parts[0]
        .filter(
          (part): part is number =>
            typeof part === "number" && Number.isInteger(part),
        )
        .slice(0, 3);
      if (date.length) item.issued = { "date-parts": [date] };
    }
    result.set(key, item);
  }
  return result;
}
// Only this fixed build-time input is admitted; .bib remains an ignored asset type.
export async function readBibliography(root: string): Promise<Bibliography> {
  const base = await realpath(root);
  let file: FileHandle;
  try {
    file = await open(
      join(base, "ref.bib"),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    if (object(error).code === "ENOENT") return new Map();
    throw new Error("Cannot safely read content/ref.bib", { cause: error });
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
      throw new Error("ref.bib must be a regular file no larger than 2 MiB");
    return parseBibliography(await file.readFile("utf8"));
  } finally {
    await file.close();
  }
}
const letters = (value: string) =>
  Array.from(value.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, ""));
export function alphabeticLabel(item: Reference) {
  const authors = item.author?.length ? item.author : item.editor;
  const family = (name: Name) =>
    (name["non-dropping-particle"]
      ? letters(name["non-dropping-particle"]).slice(0, 1).join("")
      : "") + (name.family || name.literal || "");
  const author = authors?.length
    ? authors.length === 1
      ? letters(family(authors[0])).slice(0, 3).join("")
      : authors
          .slice(0, 3)
          .map((name) => letters(family(name))[0] || "")
          .join("") + (authors.length > 3 ? "+" : "")
    : letters(item.title).slice(0, 3).join("") || "Ref";
  const year = item.issued?.["date-parts"][0][0];
  return (
    author +
    (year === undefined ? "nd" : String(year).slice(-2).padStart(2, "0"))
  );
}
function suffix(index: number): string {
  return (
    (index >= 26 ? suffix(Math.floor(index / 26) - 1) : "") +
    String.fromCharCode(97 + (index % 26))
  );
}
export function labelReferences(items: Reference[]): Reference[] {
  const bases = items.map(alphabeticLabel),
    counts = new Map<string, number>();
  for (const label of bases) counts.set(label, (counts.get(label) || 0) + 1);
  const next = new Map<string, number>(),
    used = new Set<string>();
  return items.map((item, index) => {
    const base = bases[index];
    let label = base;
    if (counts.get(base)! > 1) {
      let ordinal = next.get(base) || 0;
      do {
        label = base + suffix(ordinal++);
      } while (used.has(label) || counts.has(label));
      next.set(base, ordinal);
    }
    used.add(label);
    return { ...item, "citation-label": label };
  });
}
