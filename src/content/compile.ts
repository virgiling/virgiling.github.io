import { Resolver } from "./resolve";
import { Citations } from "../markdown/citations";
import { noteSummary } from "./summary";
import { url } from "../site.config";
import { linkableTags, tagAncestors, tagPath } from "../inline-tags";
import { MediaAssets } from "./assets";
import { createTransclusion } from "./transclusion";
import { parseNote, textOf, withoutComments } from "./parse";
import { renderNote } from "./render";
import type { Note, Asset, Diagnostic } from "./types";

export { parseNote, withoutComments, textOf };

export class Compiler {
  assets = new Map<string, Asset>();
  resolver: Resolver;
  tagURLs: Set<string>;
  citations: Citations;
  private media: MediaAssets;
  constructor(
    public root: string,
    public notes: Note[],
    public files: Set<string>,
    public diagnostics: Diagnostic[],
  ) {
    this.resolver = new Resolver(notes, diagnostics);
    this.citations = new Citations(root, diagnostics);
    this.media = new MediaAssets(this.assets);
    this.tagURLs = new Set(
      [
        ...tagAncestors(
          notes.filter((note) => !note.unlisted).flatMap(linkableTags),
        ),
      ].map((tag) => url(tagPath(tag))),
    );
  }
  asset(from: Note, target: string) {
    return this.media.resolve(this.root, this.files, from, target);
  }
  async compile(note: Note) {
    const { walk, footnotes } = createTransclusion({
      note,
      resolver: this.resolver,
      asset: (from, target) => this.asset(from, target),
    });
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
    note.summary = noteSummary(note.tree, note.description, note.title);
    await renderNote(note, tree, {
      notes: this.notes,
      assets: this.assets,
      tagURLs: this.tagURLs,
      citations: this.citations,
    });
    return note;
  }
}
