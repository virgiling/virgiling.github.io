import type { Diagnostic, DirectoryMeta, Note } from "./types";

type Candidate = Pick<
  Note,
  "source" | "url" | "title" | "publish" | "unlisted"
>;
const key = (name: string) =>
  name
    .replace(/^\d+[-_ ]+/, "")
    .normalize("NFC")
    .toLowerCase();

/** Build-time navigation plugin. Input is already publication-filtered; do not
 * scan the filesystem, infer content links, move notes or rewrite their URLs. */
export function mapDirectoryMocs(
  notes: Candidate[],
  directories: DirectoryMeta[],
  diagnostics: Diagnostic[] = [],
): DirectoryMeta[] {
  const publicNotes = notes.filter((n) => n.publish === true && !n.unlisted);
  const roots = new Set(
    directories.map((d) => d.path.split("/")[0]).filter(Boolean),
  );
  for (const note of publicNotes)
    if (note.source.includes("/")) roots.add(note.source.split("/")[0]);
  const byKey = new Map<string, string[]>();
  for (const root of roots)
    byKey.set(key(root), [...(byKey.get(key(root)) || []), root]);
  const candidates = new Map<string, Candidate[]>();
  for (const note of publicNotes) {
    const parts = note.source.split("/"),
      match = /^(.+)-toc\.md$/i.exec(parts.at(-1)!);
    // Root MoCs or a MoC directly inside its own top-level directory only.
    // Nested course outlines are ordinary notes, not guessed top-level MoCs.
    if (!match || parts.length > 2) continue;
    const targets = (byKey.get(key(match[1])) || []).filter(
      (root) => parts.length === 1 || parts[0] === root,
    );
    if (targets.length > 1) {
      diagnostics.push({
        source: note.source,
        code: "ambiguous-directory-moc",
        message:
          "A public MoC matches multiple archive roots; no automatic heading link selected.",
      });
      continue;
    }
    if (targets.length === 1)
      candidates.set(targets[0], [...(candidates.get(targets[0]) || []), note]);
  }
  // Never retain a stale link if a formerly public MoC becomes unlisted.
  const result = new Map<string, DirectoryMeta>(
    directories.map(({ path, title }) => [path, { path, title }]),
  );
  for (const [path, matches] of candidates) {
    if (matches.length !== 1) {
      diagnostics.push({
        source: matches[0].source,
        code: "ambiguous-directory-moc",
        message:
          "Multiple public MoCs match one archive root; no automatic heading link selected.",
      });
      continue;
    }
    const note = matches[0],
      entry = result.get(path) || { path, title: path };
    result.set(path, {
      ...entry,
      moc: { source: note.source, url: note.url, title: note.title },
    });
  }
  return [...result.values()];
}
