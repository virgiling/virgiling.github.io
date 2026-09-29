import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readContent } from "./read";
import { parseNote, Compiler } from "./compile";
import { url } from "../site.config";
import type { Snapshot, Diagnostic } from "./types";
import { createSnapshotCache } from "./cache";
import { mapDirectoryMocs } from "./directory-moc";

export async function buildSnapshot(root: string): Promise<Snapshot> {
  const { notes, files } = await readContent(root),
    diagnostics: Diagnostic[] = [];
  const indexDirectories = notes
    .filter((n) => n.isDirectoryIndex && !n.unlisted)
    .map((n) => ({ path: n.source.slice(0, -9), title: n.title }));
  for (const note of notes) {
    if (note.isDirectoryIndex && !note.body.trim())
      note.url =
        url("articles") +
        "#frame-folder-" +
        Buffer.from(note.source.slice(0, -9)).toString("hex");
    parseNote(note);
  }
  const compiler = new Compiler(root, notes, files, diagnostics);
  const pages = notes.filter((n) => !n.isDirectoryIndex || n.body.trim());
  for (const note of pages) await compiler.compile(note);
  const listed = pages.filter((n) => !n.unlisted);
  const directories = mapDirectoryMocs(listed, indexDirectories, diagnostics);
  return {
    notes: pages,
    listed,
    directories,
    assets: [...compiler.assets.values()],
    diagnostics,
    contentCommit: "fixture",
  };
}
const cache = createSnapshotCache(load);
export const getSnapshot = cache.get;
export const invalidateSnapshot = cache.invalidate;
// Delivered to the SSR/prerender environment by the dev integration. Keep the
// same snapshot identity so resource indexes are reused across page requests.
if (import.meta.hot)
  import.meta.hot.on("notes:content-changed", invalidateSnapshot);
async function load() {
  const root = resolve("content");
  let commit: string;
  try {
    commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const gitlink = execFileSync("git", ["ls-files", "--stage", "content"], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/);
    if (gitlink[0] !== "160000" || gitlink[1] !== commit)
      throw new Error("Content is not at the gitlink commit");
    if (
      process.env.NODE_ENV !== "development" &&
      execFileSync("git", ["-C", root, "status", "--porcelain"], {
        encoding: "utf8",
      }).trim()
    )
      throw new Error("Content submodule is dirty");
  } catch {
    throw new Error(
      "Initialize content/ at the recorded clean submodule commit before building.",
    );
  }
  const snapshot = await buildSnapshot(root);
  snapshot.contentCommit = commit;
  console.log(
    `[content] ${snapshot.notes.length} pages, ${snapshot.listed.length} discoverable, ${snapshot.assets.length} referenced assets; ${snapshot.diagnostics.length} diagnostics`,
  );
  return snapshot;
}
