import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { buildSnapshot } from "../src/content/snapshot";

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "math-render-test-"));
  try {
    for (const [name, body] of Object.entries(files))
      await writeFile(
        join(root, name),
        `---\npublish: true\ntitle: ${name}\n---\n${body}`,
      );
    return await buildSnapshot(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("display math reaches MathJax before Shiki; ordinary code and escaped dollars stay literal", async () => {
  const body = [
    "Inline $x_0^2$.",
    "$$\n\\bigvee_{i:\\, e_j \\in S_i} x_i\n$$",
    "$$\n\\begin{aligned}x &= 1 \\\\\ny &= 2\\end{aligned}\n$$",
    "```math\n\\sum_i x_i \\leq k\n```",
    "```js\nconst x = 1;\n```",
    "```latex\n\\frac{a}{b}\n```",
    "```text\n$$\n\\sum_i x_i\n$$\n```",
    "`$$not math$$` and \\$\\$escaped\\$\\$.",
  ].join("\n\n");
  const snapshot = await fixture({ "a.md": body });
  const { document } = parseHTML(snapshot.notes[0].html);
  const display = [
    ...document.querySelectorAll('mjx-container[display="true"]'),
  ];
  assert.equal(
    display.length,
    3,
    "display equations must not become plaintext code blocks",
  );
  assert.equal(
    document.querySelectorAll('mjx-container:not([display="true"])').length,
    1,
  );
  for (const equation of display) {
    assert.ok(equation.querySelector("svg path"));
    assert.equal(equation.closest("pre, code, .code-block"), null);
  }
  assert.equal(
    document.querySelector("[data-mjx-error], .mathjax-error"),
    null,
  );
  assert.equal(document.querySelectorAll("pre.shiki").length, 3);
  assert.equal(document.querySelectorAll(".code-block pre").length, 3);
  assert.equal(document.querySelector("pre mjx-container"), null);
  assert.ok(
    [...document.querySelectorAll("pre code")].some(
      (code) => code.textContent === "\\frac{a}{b}",
    ),
  );
  assert.ok(
    [...document.querySelectorAll("pre code")].some(
      (code) => code.textContent === "$$\n\\sum_i x_i\n$$",
    ),
  );
  assert.ok(
    [...document.querySelectorAll("code")].some(
      (code) => code.textContent === "$$not math$$",
    ),
  );
  assert.ok(
    [...document.querySelectorAll("p")].some((p) =>
      p.textContent?.includes("$$escaped$$"),
    ),
  );
});

test("display math survives callouts, lists, and note transclusion without a code-copy wrapper", async () => {
  const snapshot = await fixture({
    "a.md":
      "> [!aigc] Formula\n>\n> $$\n> \\sum_i x_i = 1\n> $$\n\n- Constraint:\n\n  $$\n  \\neg x \\lor y\n  $$\n\n![[b]]",
    "b.md": "$$\n\\frac{a}{b}\n$$",
  });
  const { document } = parseHTML(
    snapshot.notes.find((note) => note.source === "a.md")!.html,
  );
  assert.equal(
    document.querySelectorAll('mjx-container[display="true"]').length,
    3,
  );
  for (const parent of [".callout-content", "li", ".note-embed"]) {
    assert.ok(
      document.querySelector(`${parent} mjx-container[display="true"] svg`),
    );
  }
  assert.equal(
    document.querySelector(
      "pre, .code-block, .mathjax-error, [data-mjx-error]",
    ),
    null,
  );
});

test("Markdown heading levels and fragment IDs survive alongside display equations", async () => {
  const snapshot = await fixture({
    "a.md":
      "# Main\n\n$$\nx^2\n$$\n\n## Child\n\n### Grandchild\n\n#### Detail\n\n# Next\n\n## Child two",
  });
  const note = snapshot.notes[0];
  const { document } = parseHTML(note.html);
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  assert.deepEqual(
    headings.map((heading) => Number(heading.localName.slice(1))),
    [1, 2, 3, 4, 1, 2],
  );
  assert.deepEqual(
    headings.map((heading) => heading.id),
    note.headings.map((heading) => heading.id),
  );
  assert.deepEqual(
    note.headings.map((heading) => heading.depth),
    [1, 2, 3, 4, 1, 2],
  );
  assert.equal(
    document.querySelectorAll('mjx-container[display="true"]').length,
    1,
  );
});
