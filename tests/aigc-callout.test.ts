import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { buildSnapshot } from "../src/content/snapshot";

async function render(body: string) {
  const root = await mkdtemp(join(tmpdir(), "aigc-callout-"));
  try {
    await writeFile(join(root, "index.md"), `---\npublish: true\n---\n${body}`);
    const note = (await buildSnapshot(root)).notes[0];
    return parseHTML(note.html).document;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("AIGC callouts identify AI-generated content with a native sparkle, not a brand logo", async () => {
  const document = await render("> [!aigc]\n> 这部分内容由 AI 生成。");
  const callout = document.querySelector('aside[data-callout="aigc"]')!;
  assert.ok(callout);
  assert.equal(callout.getAttribute("data-callout-kind"), "aigc");
  assert.equal(
    callout.querySelector(".callout-title-inner")?.textContent,
    "AIGC",
  );
  assert.equal(
    callout.querySelector(".callout-content")?.textContent?.trim(),
    "这部分内容由 AI 生成。",
  );
  const icon = callout.querySelector(".callout-icon")!;
  assert.equal(icon.textContent, "✨");
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.equal(icon.querySelector("img,svg"), null);
});

test("AIGC supports case-insensitive markers, rich custom titles, folding and nesting", async () => {
  const document = await render(
    "> [!AIGC]- **AI 草稿**\n> 草稿正文\n>\n> > [!aigc]+\n> > 内层正文",
  );
  const callouts = [
    ...document.querySelectorAll('details[data-callout="aigc"]'),
  ];
  assert.equal(callouts.length, 2);
  assert.equal(callouts[0].hasAttribute("open"), false);
  assert.equal(
    callouts[0].querySelector("summary strong")?.textContent,
    "AI 草稿",
  );
  assert.equal(callouts[1].hasAttribute("open"), true);
  assert.equal(
    callouts[1].querySelector(".callout-title-inner")?.textContent,
    "AIGC",
  );
});

test("nonstandard ![aigc] stays ordinary Markdown, including real image references", async () => {
  const document = await render(
    "> ![aigc]\n> AI 正文\n\n> ![AIGC]- 自定义标题\n> 可折叠正文\n\n> ![aigc](https://example.test/a.png)\n\n> ![aigc][picture]\n\n[picture]: https://example.test/b.png",
  );
  assert.equal(document.querySelectorAll('[data-callout="aigc"]').length, 0);
  assert.match(document.querySelector("blockquote")!.textContent!, /!\[aigc\]/);
  assert.deepEqual(
    [...document.querySelectorAll("blockquote img")].map((image) =>
      image.getAttribute("src"),
    ),
    ["https://example.test/a.png", "https://example.test/b.png"],
  );
  const reference = await render(
    "> ![aigc]\n\n[aigc]: https://example.test/reference.png",
  );
  assert.equal(reference.querySelector(".callout"), null);
  assert.equal(
    reference.querySelector("img")?.getAttribute("src"),
    "https://example.test/reference.png",
  );
});

test("escaped markers and code remain literal; other unknown types keep the normal fallback", async () => {
  const document = await render(
    "> \\[!aigc]\n> 普通引用\n\n> \\![aigc]\n\n> `[!aigc]`\n\n> `![aigc]`\n\n```md\n> [!aigc]\n> ![aigc]\n```\n\n> [!custom-type]\n> 正文",
  );
  assert.equal(document.querySelectorAll('[data-callout="aigc"]').length, 0);
  assert.equal(document.querySelector("pre code .callout"), null);
  assert.equal(
    document
      .querySelector('[data-callout="custom-type"]')
      ?.getAttribute("data-callout-kind"),
    "note",
  );
  assert.equal(
    document.querySelector('[data-callout="custom-type"] .callout-title-inner')
      ?.textContent,
    "Custom-type",
  );
});
