import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { classifyContentPath } from "../content-policy";
import { url } from "../site.config";
import { contentFile } from "./read";
import { drawingScene } from "./drawing-scene";
import type { Asset, Diagnostic, DrawingAsset, Note } from "./types";

const stem = (path: string) => path.replace(/\.md$/i, "");
export class Drawings {
  private sources: string[];
  private pending = new Map<string, Promise<DrawingAsset | undefined>>();
  constructor(
    private root: string,
    files: Set<string>,
    private assets: Map<string, Asset>,
    private diagnostics: Diagnostic[],
  ) {
    this.sources = [...files].filter(
      (path) => classifyContentPath(path) === "drawing",
    );
  }
  async resolve(from: Note, target: string) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      return;
    }
    if (
      decoded.includes("\\") ||
      decoded.startsWith("/") ||
      /^[a-z][\w+.-]*:/i.test(decoded) ||
      !/\.excalidraw(?:\.md)?$/i.test(decoded)
    )
      return;
    const relative = posix.normalize(
      posix.join(posix.dirname(from.source), decoded),
    );
    let matches: string[] = [];
    for (const candidate of [relative, decoded]) {
      matches = this.sources.filter(
        (source) => stem(source) === stem(candidate),
      );
      if (matches.length) break;
    }
    if (!matches.length && !decoded.includes("/"))
      matches = this.sources.filter(
        (source) => stem(posix.basename(source)) === stem(decoded),
      );
    if (matches.length !== 1) {
      this.diagnostics.push({
        source: from.source,
        code: "unavailable-drawing",
        message: "Drawing is missing, excluded or ambiguous",
      });
      return;
    }
    const source = matches[0];
    if (!this.pending.has(source))
      this.pending.set(source, this.load(source, from));
    return this.pending.get(source);
  }
  private async load(
    source: string,
    from: Note,
  ): Promise<DrawingAsset | undefined> {
    try {
      const text = await readFile(
        await contentFile(this.root, source, "drawing"),
        "utf8",
      );
      const content = drawingScene(text, source.toLowerCase().endsWith(".md"));
      const output =
        createHash("sha256").update(content).digest("hex").slice(0, 24) +
        ".excalidraw.json";
      const asset: DrawingAsset = {
        kind: "excalidraw",
        source,
        output,
        url: url("media/" + output),
        content,
      };
      this.assets.set(source, asset);
      return asset;
    } catch {
      // Never echo drawing text, JSON parse snippets or embedded private paths.
      this.diagnostics.push({
        source: from.source,
        code: "invalid-drawing",
        message:
          "Drawing could not be decoded or contains unsupported embedded resources",
      });
      return;
    }
  }
}
