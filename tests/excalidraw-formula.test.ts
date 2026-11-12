import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOMParser, parseHTML } from "linkedom";
import { drawingScene } from "../src/content/drawing-scene";
import { buildSnapshot } from "../src/content/snapshot";
import { GET } from "../src/pages/media/[file]";
import { drawingMarkdown, formulaScene, rectangle } from "./helpers/drawings";

type Scene = {
  elements: Record<string, unknown>[];
  files: Record<string, { id: string; dataURL: string; mimeType: string }>;
};
const equations = { "formula-file": "G_{0, 1}" };
function svgOf(file: Scene["files"][string]) {
  assert.equal(file.mimeType, "image/svg+xml");
  assert.match(file.dataURL, /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(file.dataURL.split(",")[1], "base64").toString(
    "utf8",
  );
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  assert.equal(root.localName, "svg");
  assert.equal(root.getAttribute("xmlns"), "http://www.w3.org/2000/svg");
  assert.ok(root.querySelector("path"));
  assert.ok(Number(root.getAttribute("width")) > 0);
  assert.ok(Number(root.getAttribute("height")) > 0);
  const [, , width, height] = root
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  assert.ok(
    Math.abs(
      Number(root.getAttribute("width")) / Number(root.getAttribute("height")) -
        width / height,
    ) < 1e-9,
  );
  assert.doesNotMatch(
    svg,
    /<(?:script|style|foreignObject|image|use|a)[\s>]|href=|PRIVATE_|\$\$/,
  );
  return svg;
}

test("Obsidian formulas become self-contained SVG images without changing scene geometry", () => {
  let expected = "";
  for (const compressed of [false, true]) {
    for (const heading of ["## Embedded Files", "# Embedded files"]) {
      for (const newline of ["\n", "\r\n"]) {
        const source = drawingMarkdown(formulaScene, compressed, equations)
          .replace("## Embedded Files", heading)
          .replaceAll("\n", newline);
        const output = drawingScene(source, true);
        expected ||= output;
        assert.equal(output, expected);
        const scene: Scene = JSON.parse(output);
        assert.equal(Object.keys(scene.files).length, 1);
        assert.equal(scene.files["formula-file"].id, "formula-file");
        svgOf(scene.files["formula-file"]);
        assert.deepEqual(
          scene.elements.find((element) => element.id === "formula-image"),
          {
            ...Object.fromEntries(
              Object.entries(formulaScene.elements[2]).filter(
                ([key]) => !["updated", "link"].includes(key),
              ),
            ),
          },
        );
        assert.doesNotMatch(output, /PRIVATE_|Embedded Files|\$\$/);
      }
    }
  }
});

test("multiline fractions, matrices and colors render deterministically with standalone paths", () => {
  for (const latex of [
    String.raw`\frac{a^2+\sqrt b}{c}`,
    String.raw`\begin{pmatrix}a & b \\
c & d\end{pmatrix}`,
    String.raw`\color{red}{G_{0,1}}`,
  ]) {
    const source = drawingMarkdown(formulaScene, true, {
      "formula-file": latex,
    });
    const first = drawingScene(source, true);
    const svg = svgOf((JSON.parse(first) as Scene).files["formula-file"]);
    if (latex.includes("color")) assert.match(svg, /(?:fill|stroke)="red"/);
    drawingScene(drawingMarkdown(formulaScene, true, equations), true);
    assert.equal(drawingScene(source, true), first);
  }
});

test("only used formulas render; deleted images, metadata and formula links stay out", () => {
  const source = drawingMarkdown(
    {
      ...formulaScene,
      elements: [
        ...formulaScene.elements,
        { ...rectangle, type: "image", isDeleted: true, fileId: "deleted" },
      ],
      files: { orphan: { dataURL: "PRIVATE_ORPHAN" } },
    },
    true,
    {
      "formula-file": String.raw`\href{https://private.invalid}{G_0}`,
      orphan: String.raw`PRIVATE_ORPHAN \frac{`,
      deleted: String.raw`PRIVATE_DELETED \frac{`,
    },
  );
  const scene: Scene = JSON.parse(drawingScene(source, true));
  assert.deepEqual(Object.keys(scene.files), ["formula-file"]);
  assert.doesNotMatch(svgOf(scene.files["formula-file"]), /private\.invalid/);
});

test("broken formulas and external resources still fail instead of yielding incomplete drawings", () => {
  assert.throws(() =>
    drawingScene(
      drawingMarkdown(formulaScene, true, {
        "formula-file": String.raw`\frac{`,
      }),
      true,
    ),
  );
  for (const metadata of [
    "formula-file: [[private/image.png]]",
    "formula-file: https://private.invalid/image.png",
    "formula-file: $$G_0", // Unterminated formula.
  ]) {
    const source = drawingMarkdown(formulaScene, true).replace(
      "# Drawing",
      `## Embedded Files\n${metadata}\n\n# Drawing`,
    );
    assert.throws(() => drawingScene(source, true));
  }
  assert.throws(() =>
    drawingScene(
      JSON.stringify({
        ...formulaScene,
        files: {
          "formula-file": { dataURL: "data:image/svg+xml;base64,AA==" },
        },
      }),
      false,
    ),
  );
});

test("published formula drawings flow through compilation and the JSON route without source metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "drawing-formula-test-"));
  try {
    await mkdir(join(root, "Excalidraw/drawing"), { recursive: true });
    await writeFile(
      join(root, "a.md"),
      "---\npublish: true\ntitle: Test\n---\n![[formula.excalidraw|Formula|800]]",
    );
    await writeFile(
      join(root, "Excalidraw/drawing/formula.excalidraw.md"),
      drawingMarkdown(formulaScene, true, equations),
    );
    await writeFile(
      join(root, "Excalidraw/drawing/orphan.excalidraw.md"),
      drawingMarkdown(formulaScene, true, {
        "formula-file": String.raw`PRIVATE_ORPHAN \frac{`,
      }),
    );
    const snapshot = await buildSnapshot(root);
    assert.equal(snapshot.assets.length, 1);
    assert.deepEqual(snapshot.diagnostics, []);
    const { document } = parseHTML(snapshot.notes[0].html);
    const figure = document.querySelector("figure[data-excalidraw]")!;
    assert.equal(figure.getAttribute("data-width"), "800");
    assert.equal(
      figure.getAttribute("data-excalidraw"),
      snapshot.assets[0].url,
    );
    const response = await GET({ props: { asset: snapshot.assets[0] } });
    assert.equal(response.status, 200);
    const body = await response.text();
    svgOf((JSON.parse(body) as Scene).files["formula-file"]);
    assert.doesNotMatch(
      body + snapshot.notes[0].html,
      /PRIVATE_|Embedded Files/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
