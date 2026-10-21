import { posix } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { url } from "../site.config";
import { contentFile } from "./read";
import type { Note, Asset } from "./types";

export const mediaTypes = new Set([
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
export class MediaAssets {
  constructor(public assets: Map<string, Asset>) {}
  async resolve(root: string, files: Set<string>, from: Note, target: string) {
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
      (path) => !path.startsWith("../") && files.has(path),
    );
    if (!source && !decoded.includes("/")) {
      const candidates = [...files].filter(
        (f) => posix.basename(f) === decoded,
      );
      if (candidates.length === 1) source = candidates[0];
    }
    if (!source) return undefined;
    if (!this.assets.has(source)) {
      const buffer = await readFile(await contentFile(root, source));
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
}
