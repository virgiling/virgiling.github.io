import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseHTML } from "linkedom";
import { buildSnapshot } from "../src/content/snapshot";
import { readContent, contentFile } from "../src/content/read";
import { drawingScene } from "../src/content/drawing-scene";
import { classifyContentPath } from "../src/content-policy";
import { watchedContentPath } from "../src/dev/content-watch";
import { GET } from "../src/pages/media/[file]";
import { url } from "../src/site.config";
import { drawingMarkdown, rectangle, sampleScene } from "./helpers/drawings";

const folder = "Excalidraw/drawing/";
const note = (body: string, meta = "") =>
  `---\npublish: true\ntitle: Test\n${meta}---\n${body}`;
async function fixture(
  files: Record<string, string>,
  run: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "excalidraw-test-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), content);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("compressed and plain Obsidian Drawing sections decode before Markdown comment removal", () => {
  const expected = drawingScene(JSON.stringify(sampleScene), false);
  for (const compressed of [true, false]) {
    assert.equal(
      drawingScene(drawingMarkdown(sampleScene, compressed), true),
      expected,
    );
    assert.equal(
      drawingScene(
        drawingMarkdown(sampleScene, compressed).replaceAll("\n", "\r\n"),
        true,
      ),
      expected,
    );
  }
  assert.doesNotMatch(expected, /PRIVATE_|fixture/);
  assert.throws(() =>
    drawingScene("# Drawing\n```compressed-json\nbad\n```", true),
  );
  assert.throws(() => drawingScene("not json", false));
  assert.throws(() => drawingScene("{}", false));
});

test("only visible rendering data and referenced embedded raster bytes enter scene resources", () => {
  const input = {
    ...sampleScene,
    elements: [
      {
        ...sampleScene.elements[1],
        originalText: "PRIVATE_ORIGINAL",
        customData: { secret: "PRIVATE_CUSTOM" },
        link: "https://private.invalid",
      },
      { ...rectangle, id: "deleted", isDeleted: true, text: "PRIVATE_DELETED" },
      { ...rectangle, id: "image", type: "image", fileId: "image-file" },
      {
        ...rectangle,
        id: "free",
        type: "freedraw",
        points: [
          [0, 0],
          [20, 10],
        ],
        pressures: [0.5, 0.7],
        simulatePressure: false,
        lastCommittedPoint: null,
      },
    ],
    appState: { selectedElementIds: { PRIVATE_SELECTION: true } },
    files: {
      "image-file": {
        dataURL: "data:image/png;base64,AA==",
        customData: "PRIVATE_FILE",
      },
      orphan: { dataURL: "PRIVATE_ORPHAN" },
    },
  };
  const content = drawingScene(JSON.stringify(input), false);
  assert.doesNotMatch(content, /PRIVATE_|private\.invalid/);
  assert.match(content, /data:image\/png;base64,AA==/);
  assert.match(content, /"pressures":\[0.5,0.7\]/);
  assert.match(content, /"simulatePressure":false/);
  for (const dataURL of [
    "https://example.test/image.png",
    "data:image/svg+xml;base64,AA==",
    undefined,
  ])
    assert.throws(() =>
      drawingScene(
        JSON.stringify({ ...input, files: { "image-file": { dataURL } } }),
        false,
      ),
    );
  assert.throws(() =>
    drawingScene(
      JSON.stringify({
        ...sampleScene,
        elements: [{ ...rectangle, type: "embeddable" }],
      }),
      false,
    ),
  );
});

test("drawing folder is attachment-only; other Excalidraw and private files stay excluded", async () => {
  await fixture(
    {
      "a.md": note("Hello"),
      [folder + "orphan.excalidraw.md"]: "BROKEN_UNREFERENCED_DRAWING",
      [folder + "note.md"]: note("PRIVATE_NOTE"),
      [folder + "photo.png"]: "PRIVATE_PNG",
      [folder + "private/hidden.excalidraw"]: "PRIVATE_HIDDEN",
      "Excalidraw/other.excalidraw.md": "PRIVATE_OTHER",
      "private/hidden.excalidraw": "PRIVATE_HIDDEN",
    },
    async (root) => {
      const { notes, files } = await readContent(root);
      assert.equal(notes.length, 1);
      assert.deepEqual(
        [...files].sort(),
        [folder + "orphan.excalidraw.md", "a.md"].sort(),
      );
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.assets.length, 0);
      assert.equal(snapshot.diagnostics.length, 0);
      await assert.rejects(contentFile(root, folder + "orphan.excalidraw.md"));
    },
  );
  assert.equal(
    classifyContentPath("private/Excalidraw/drawing/a.excalidraw"),
    "ignored",
  );
  assert.equal(
    watchedContentPath("/vault/" + folder + "a.excalidraw.md", "/vault"),
    true,
  );
  assert.equal(
    watchedContentPath("/vault/Excalidraw/other.md", "/vault"),
    false,
  );
});

test("wiki embeds, aliases, sizing, Markdown images and transclusions share one generated scene", async () => {
  await fixture(
    {
      "a.md": note(
        "Before ![[示意图.excalidraw|320x200]] after.\n\n![[Excalidraw/drawing/示意图.excalidraw.md|说明]]\n\n[[示意图.excalidraw|下载]]\n\n![Markdown](Excalidraw/drawing/示意图.excalidraw.md)\n\n![[nested/b]]",
      ),
      "nested/b.md": note("![[../Excalidraw/drawing/示意图.excalidraw]]"),
      [folder + "示意图.excalidraw.md"]: drawingMarkdown(),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.assets.length, 1);
      const asset = snapshot.assets[0];
      assert.equal(asset.kind, "excalidraw");
      const a = snapshot.notes.find((n) => n.source === "a.md")!;
      const { document } = parseHTML(a.html);
      const figures = document.querySelectorAll("figure[data-excalidraw]");
      assert.equal(figures.length, 4);
      assert.equal(figures[0].getAttribute("data-width"), "320");
      assert.equal(figures[0].getAttribute("data-height"), "200");
      assert.equal(figures[1].getAttribute("data-label"), "说明");
      assert.equal(figures[0].getAttribute("data-excalidraw"), asset.url);
      assert.equal(document.querySelector("p figure"), null);
      assert.equal(document.querySelector("img"), null);
      assert.ok(
        [...document.querySelectorAll("a")].some(
          (a) =>
            a.textContent === "下载" && a.getAttribute("href") === asset.url,
        ),
      );
      assert.doesNotMatch(
        a.html + a.plainText,
        /PRIVATE_|compressed-json|Example 示例/,
      );
      assert.deepEqual(a.links, ["nested/b.md"]);
      const response = await GET({ props: { asset } });
      assert.match(response.headers.get("content-type")!, /application\/json/);
      assert.doesNotMatch(await response.text(), /PRIVATE_|compressed-json/);
    },
  );
});

test("short drawing names accept label plus size without changing ordinary link labels", async () => {
  const name = "DPLL-Bruteforce-Tree.excalidraw";
  await fixture(
    {
      "a.md": note(
        `![[${name}|暴力搜索树|900]]\n\n![[${name}|说明|900x600]]\n\n![[${name}|A|B]]\n\n![[missing.excalidraw|缺失图|900]]\n\n[[${name}|普通链接|900]]`,
      ),
      [folder + name + ".md"]: drawingMarkdown(),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.assets.length, 1);
      assert.equal(snapshot.assets[0].source, folder + name + ".md");
      const { document } = parseHTML(snapshot.notes[0].html);
      const figures = [...document.querySelectorAll("figure[data-excalidraw]")];
      assert.deepEqual(
        figures.map((node) => [
          node.getAttribute("data-label"),
          node.getAttribute("data-width"),
          node.getAttribute("data-height"),
        ]),
        [
          ["暴力搜索树", "900", null],
          ["说明", "900", "600"],
          ["A|B", null, null],
        ],
      );
      assert.equal(
        document.querySelector(`a[href="${url("404")}"]`)?.textContent,
        "缺失图",
      );
      assert.ok(
        [...document.querySelectorAll("a")].some(
          (node) => node.textContent === "普通链接|900",
        ),
      );
    },
  );
});

test("ambiguous, missing, private, malformed and unsupported targets do not leak source content", async () => {
  await fixture(
    {
      "a.md": note(
        '![[same.excalidraw]] ![[missing.excalidraw.md]] ![[private/p.excalidraw]] ![[broken.excalidraw]]\n\n<figure data-excalidraw="https://example.test/scene.json">forged</figure>\n\n![[Hidden]]',
      ),
      [folder + "same.excalidraw"]: JSON.stringify(sampleScene),
      [folder + "same.excalidraw.md"]: drawingMarkdown(),
      [folder + "broken.excalidraw.md"]: "PRIVATE_BROKEN",
      [folder + "hidden.excalidraw"]: JSON.stringify(sampleScene),
      "private/p.excalidraw": "PRIVATE_DRAWING",
      "Hidden.md": note("![[hidden.excalidraw]]", "unlisted: true\n"),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      const a = snapshot.notes.find((n) => n.source === "a.md")!;
      assert.doesNotMatch(
        a.html,
        /data-excalidraw|PRIVATE_|hidden\.excalidraw/,
      );
      assert.ok(a.html.includes(url("404")));
      assert.ok(snapshot.diagnostics.some((d) => d.code === "invalid-drawing"));
      assert.ok(
        snapshot.diagnostics.some((d) => d.code === "unavailable-drawing"),
      );
      assert.equal(snapshot.assets.length, 1); // Only the explicitly published unlisted page's scene.
    },
  );
});

test("drawing symlinks are rejected before reading their content", async () => {
  await fixture(
    {
      "a.md": note("![[linked.excalidraw]]"),
      [folder + "good.excalidraw"]: JSON.stringify(sampleScene),
    },
    async (root) => {
      await symlink(
        join(root, folder, "good.excalidraw"),
        join(root, folder, "linked.excalidraw"),
      );
      await assert.rejects(buildSnapshot(root), /Symbolic links/);
    },
  );
});
