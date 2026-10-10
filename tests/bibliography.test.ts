import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { parseHTML, DOMParser } from "linkedom";
import { buildSnapshot } from "../src/content/snapshot";
import {
  readBibliography,
  parseBibliography,
  labelReferences,
  alphabeticLabel,
} from "../src/content/bibliography";
import { extractPreviewContent } from "../src/runtime/preview-content";
import { classifyContentPath } from "../src/content-policy";
import { watchedContentPath } from "../src/dev/content-watch";
import { renderComponent } from "./helpers/render-astro";

const md = (body: string, extra = "") =>
  `---\npublish: true\ntitle: Public\n${extra}---\n${body}`;
const bib = `
@book{lamport1994latex, author={Lamport, Leslie}, title={LaTeX: A Document Preparation System}, edition={2}, publisher={Addison-Wesley}, year={1994}, doi={DOI_CANARY}, url={https://example.com/URL_CANARY}, isbn={ISBN_CANARY}, eprint={EPRINT_CANARY}, abstract={ABSTRACT_CANARY}, note={NOTE_CANARY}, file={PRIVATE_FILE_CANARY}}
@inproceedings{vaswani2017attention, author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N. and Kaiser, Lukasz and Polosukhin, Illia}, title={Attention Is All You Need}, booktitle={Advances in Neural Information Processing Systems}, volume={30}, pages={5998--6008}, year={2017}}
@article{unused, author={Someone, Else}, title={UNCITED_TITLE_CANARY}, year={2000}}
`;
async function fixture(
  files: Record<string, string>,
  run: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "bibliography-test-"));
  try {
    for (const [path, value] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), value);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function document(html: string) {
  return parseHTML(`<html><body>${html}</body></html>`).document;
}

test("Slides alphabetic labels, first-citation ordering and three initialized authors are reused in the References chapter", async () => {
  await fixture(
    {
      "ref.bib": bib,
      "a.md": md(
        "## Introduction\n\nFirst [@vaswani2017attention], then [@lamport1994latex]. Again [see @vaswani2017attention; @lamport1994latex, pp. 4–5].",
      ),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root),
        note = snapshot.notes[0],
        doc = document(note.html);
      assert.equal(
        snapshot.diagnostics.filter((d) => d.code.includes("citation")).length,
        0,
      );
      const entries = [...doc.querySelectorAll(".csl-entry")];
      assert.equal(entries.length, 2);
      assert.match(entries[0].textContent!.trim(), /^\[VSP\+17\]/);
      assert.match(entries[1].textContent!.trim(), /^\[Lam94\]/);
      assert.match(
        entries[0].textContent!,
        /A\. Vaswani, N\. Shazeer, N\. Parmar, et al\./,
      );
      assert.match(entries[1].textContent!, /L\. Lamport/);
      assert.match(entries[1].textContent!, /2nd ed\./);
      assert.equal(
        doc.querySelector("i.reference-venue")?.textContent,
        "Advances in Neural Information Processing Systems",
      );
      assert.equal(doc.querySelectorAll(".citation").length, 3);
      assert.match(
        doc.querySelectorAll(".citation")[2].textContent!,
        /pp\. 4–5/,
      );
      for (const link of doc.querySelectorAll(".citation a")) {
        assert.ok(doc.getElementById(link.getAttribute("href")!.slice(1)));
        assert.equal(link.hasAttribute("data-preview"), false);
      }
      assert.deepEqual(
        note.headings.map((h) => h.text),
        ["Introduction", "References"],
      );
      assert.deepEqual(note.links, []);
      assert.equal(
        doc.querySelector("h2#references")?.textContent,
        "References#",
      );
      assert.equal(snapshot.assets.length, 0);
      assert.doesNotMatch(
        note.html,
        /(?:DOI|URL|ISBN|EPRINT|ABSTRACT|NOTE|PRIVATE_FILE|UNCITED_TITLE)_CANARY/,
      );
      assert.doesNotMatch(
        note.plainText,
        /Attention Is All You Need|Document Preparation/,
      );
      assert.equal(
        doc.querySelector("[data-citation-index], [data-cite]"),
        null,
      );
    },
  );
});

test("references and labels are per article, preserve case-sensitive keys, and disambiguate before the first citation", async () => {
  const same = `@book{one,author={Lamport, Leslie},title={One},year={1994}}
@book{One,author={Lamport, Leslie},title={Two},year={1994}}
@book{uncited,author={Lamport, Leslie},title={NOT_CITED},year={1994}}`;
  await fixture(
    {
      "ref.bib": same,
      "a.md": md("[@One] then [@one] then [@One]."),
      "b.md": md("[@one]"),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root),
        a = document(snapshot.notes.find((n) => n.id === "a.md")!.html),
        b = document(snapshot.notes.find((n) => n.id === "b.md")!.html);
      assert.deepEqual(
        [...a.querySelectorAll(".citation")].map((n) => n.textContent),
        ["[Lam94a]", "[Lam94b]", "[Lam94a]"],
      );
      assert.equal(b.querySelector(".citation")!.textContent, "[Lam94]");
      assert.equal(
        new Set([...a.querySelectorAll(".csl-entry")].map((n) => n.id)).size,
        2,
      );
      assert.doesNotMatch(a.body.textContent!, /NOT_CITED/);
    },
  );
});

test("unknown keys remain authored text and do not block subsequent valid citations", async () => {
  await fixture(
    {
      "ref.bib": bib,
      "a.md": md(
        "[@missing] then [@lamport1994latex]. Mixed [@missing; @vaswani2017attention].",
      ),
    },
    async (root) => {
      const s = await buildSnapshot(root),
        doc = document(s.notes[0].html);
      assert.match(doc.body.textContent!, /\[@missing\]/);
      assert.match(
        doc.body.textContent!,
        /\[@missing; @vaswani2017attention\]/,
      );
      assert.equal(doc.querySelectorAll(".csl-entry").length, 1);
      assert.equal(doc.querySelector(".citation")?.textContent, "[Lam94]");
      assert.equal(
        s.diagnostics.filter((d) => d.code === "unknown-citation").length,
        2,
      );
    },
  );
});

test("code, math, escaped citations, raw HTML and authored links remain literal, with no empty References chapter", async () => {
  const body =
    "`[@lamport1994latex]`\n\n```text\n[@lamport1994latex]\n```\n\n\\[@lamport1994latex] $[@lamport1994latex]$\n\n<code>[@lamport1994latex]</code>\n\n<div>[@lamport1994latex]</div>\n\n[[@lamport1994latex]](https://example.com) user@example.com @lamport1994latex";
  await fixture(
    {
      "ref.bib": "INVALID UNUSED BIB",
      "a.md": md(
        body,
        "citekey: lamport1994latex\nbibliography: https://example.invalid/private.bib\nnoCite: ['@*']\ncsl: /private/style.csl\n",
      ),
    },
    async (root) => {
      const s = await buildSnapshot(root),
        doc = document(s.notes[0].html);
      assert.equal(doc.querySelector(".references, .citation"), null);
      assert.equal(s.notes[0].headings.length, 0);
      assert.match(
        doc.querySelector("code")!.textContent!,
        /\[@lamport1994latex\]/,
      );
      assert.equal(
        doc.querySelector('a[href="https://example.com"]')?.textContent,
        "[@lamport1994latex]",
      );
    },
  );
});

test("citations in emphasis, headings, tables and footnotes share one bibliography with transcluded citations", async () => {
  await fixture(
    {
      "ref.bib": bib,
      "a.md": md(
        "## Work [@lamport1994latex]\n\n**[@lamport1994latex]**\n\n![[b]]\n\n| Cite |\n| --- |\n| [@lamport1994latex] |\n\nNote[^n].\n\n[^n]: [@vaswani2017attention]",
      ),
      "b.md": md("[@vaswani2017attention]"),
      "private.md": "---\npublish: false\n---\n[@unused]",
    },
    async (root) => {
      const s = await buildSnapshot(root),
        note = s.notes.find((n) => n.id === "a.md")!,
        doc = document(note.html);
      assert.equal(doc.querySelectorAll(".references").length, 1);
      assert.equal(doc.querySelectorAll(".csl-entry").length, 2);
      for (const selector of [
        "h2 .citation",
        "strong .citation",
        "td .citation",
        ".footnotes .citation",
        "blockquote .citation",
      ])
        assert.ok(doc.querySelector(selector), selector);
      assert.ok(
        note.html.indexOf('class="references"') <
          note.html.indexOf('class="footnotes"'),
      );
      assert.equal(
        new Set([...doc.querySelectorAll("[id]")].map((n) => n.id)).size,
        doc.querySelectorAll("[id]").length,
      );
      assert.deepEqual(note.links, ["b.md"]);
      assert.equal(note.headings[0].text, "Work [Lam94]");
    },
  );
});

test("terminal References headings are reused and generated reference anchors avoid authored ID collisions", async () => {
  const target = [...parseBibliography(bib).values()][0].id;
  await fixture(
    {
      "ref.bib": bib,
      "a.md": md(
        `[@lamport1994latex]\n\n<span id="ref-${target}"></span>\n\n## References`,
      ),
      "b.md": md(
        "## References\n\nManual context.\n\n## Later\n\n[@lamport1994latex]",
      ),
    },
    async (root) => {
      const s = await buildSnapshot(root),
        a = s.notes.find((n) => n.id === "a.md")!,
        b = s.notes.find((n) => n.id === "b.md")!,
        doc = document(a.html);
      assert.equal(a.headings.filter((h) => h.text === "References").length, 1);
      assert.equal(doc.querySelectorAll("h2").length, 1);
      assert.equal(
        doc.querySelector(".citation a")!.getAttribute("href"),
        `#ref-${target}-1`,
      );
      assert.equal(b.headings.at(-1)?.id, "references-1");
    },
  );
});

test("full previews retain References and scope citation fragment targets", async () => {
  await fixture(
    { "ref.bib": bib, "a.md": md("[@lamport1994latex]") },
    async (root) => {
      const note = (await buildSnapshot(root)).notes[0];
      const { container, ids } = extractPreviewContent(
        `<article data-note-id="a.md"><div class="prose" data-preview-content>${note.html}</div></article>`,
        "a.md",
        new URL("https://site.test/base/a"),
        "preview",
        new DOMParser() as unknown as globalThis.DOMParser,
      );
      const entry = container.querySelector(".csl-entry")!,
        link = container.querySelector(".citation a")!;
      assert.equal(link.getAttribute("data-preview-anchor"), entry.id);
      assert.match(
        link.getAttribute("href")!,
        /^https:\/\/site\.test\/base\/a#ref-/,
      );
      assert.ok(ids.has("references"));
    },
  );
});

test("only the fixed ref.bib is watched, never exposed as an asset, and symlinks are rejected", async () => {
  assert.equal(classifyContentPath("ref.bib"), "ignored");
  assert.equal(watchedContentPath("/content/ref.bib", "/content"), true);
  for (const path of [
    "/content/other.bib",
    "/content/nested/ref.bib",
    "/content/private/ref.bib",
    "/outside/ref.bib",
  ])
    assert.equal(watchedContentPath(path, "/content"), false);
  await fixture(
    { "source.bib": bib, "a.md": md("[@lamport1994latex]") },
    async (root) => {
      await symlink(join(root, "source.bib"), join(root, "ref.bib"));
      await assert.rejects(readBibliography(root), /safely read/);
    },
  );
  await fixture({ "a.md": md("[@missing]") }, async (root) => {
    const s = await buildSnapshot(root);
    assert.equal(s.notes[0].headings.length, 0);
    assert.equal(
      s.diagnostics.some((d) => d.code === "unknown-citation"),
      true,
    );
  });
});

test("generated References is rendered by the actual desktop and mobile TOC component", async () => {
  await fixture(
    { "ref.bib": bib, "a.md": md("[@lamport1994latex]") },
    async (root) => {
      const note = (await buildSnapshot(root)).notes[0];
      for (const mobile of [false, true]) {
        const doc = document(
          await renderComponent("OnThisPage", {
            headings: note.headings,
            mobile,
          }),
        );
        assert.equal(
          doc.querySelector('a[href="#references"]')?.textContent,
          "References",
        );
      }
    },
  );
});

test("raw HTML cannot impersonate citation markers, and metadata cannot inject executable HTML", async () => {
  await fixture(
    {
      "ref.bib":
        '@book{x,author={Example, Alice},title={Safe &#60;img src="https://example.com/tracker"&#62; <script>BAD</script>},year={2024}}',
      "a.md": md('[@x]\n\n<span data-citation-index="0">RAW_LITERAL</span>'),
    },
    async (root) => {
      const note = (await buildSnapshot(root)).notes[0],
        doc = document(note.html);
      assert.equal(doc.querySelectorAll(".citation").length, 1);
      assert.equal(
        doc.querySelector(".references img, .references script"),
        null,
      );
      assert.match(doc.body.textContent!, /RAW_LITERAL/);
      assert.doesNotMatch(note.html, /BAD/);
    },
  );
});

test("oversized bibliography files are rejected before parsing", async () => {
  await fixture(
    { "ref.bib": " ".repeat(2 * 1024 * 1024 + 1) },
    async (root) => {
      await assert.rejects(readBibliography(root), /2 MiB/);
    },
  );
});

test("bibliography projection rejects duplicates and strips HTML and non-display metadata", () => {
  assert.throws(
    () => parseBibliography("@book{same,title={One}}\n@book{same,title={Two}}"),
    /Duplicate/,
  );
  const data = parseBibliography(
    '@article{x,author={García, Ana},title={<img src="https://example.com/tracker">Safe <script>EVIL</script> title},journaltitle={Journal},date={2024-02-01},abstract={PRIVATE},file={PRIVATE},url={https://example.com/PRIVATE}}',
  );
  const item = data.get("x")!;
  assert.equal(item["container-title"], "Journal");
  assert.equal(alphabeticLabel(item), "Gar24");
  assert.doesNotMatch(JSON.stringify(item), /PRIVATE|tracker|EVIL|<img|script/);
  assert.equal(
    alphabeticLabel({ id: "x", type: "book", title: "Manual" }),
    "Mannd",
  );
  assert.deepEqual(
    labelReferences([
      { id: "a", type: "book", title: "Manual" },
      { id: "b", type: "book", title: "Manual" },
    ]).map((i) => i["citation-label"]),
    ["Mannda", "Manndb"],
  );
});
