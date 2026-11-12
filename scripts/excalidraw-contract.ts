import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DOMParser } from "linkedom";
import { drawingScene } from "../src/content/drawing-scene";
import { drawingMarkdown, formulaScene } from "../tests/helpers/drawings";
import type { DrawingAsset, Snapshot } from "../src/content/types";

// Exercise the real dev HTML and generated media endpoint using an in-memory
// public snapshot fixture. No content files or gitlink changes are needed.
export async function verifyDevExcalidraw(
  origin: string,
  base: string,
  snapshot: Snapshot,
) {
  const content = drawingScene(
    drawingMarkdown(formulaScene, true, { "formula-file": "G_{0,1}" }),
    true,
  );
  const output =
    createHash("sha256").update(content).digest("hex").slice(0, 24) +
    ".excalidraw.json";
  const asset: DrawingAsset = {
    kind: "excalidraw",
    source: "Excalidraw/drawing/fixture.excalidraw.md",
    output,
    url: base + "media/" + output,
    content,
  };
  const note = snapshot.notes.find((note) => note.source === "index.md")!;
  const original = note.html;
  snapshot.assets.push(asset);
  note.html += `<figure class="excalidraw-embed" data-excalidraw="${asset.url}" data-label="Fixture"><p><a href="${asset.url}">Drawing data</a></p></figure>`;
  try {
    const response = await fetch(origin + base);
    assert.equal(response.status, 200);
    const document = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    assert.equal(
      document
        .querySelector("figure[data-excalidraw]")
        ?.getAttribute("data-excalidraw"),
      asset.url,
    );
    const scene = await fetch(origin + asset.url);
    assert.equal(scene.status, 200);
    assert.match(scene.headers.get("content-type")!, /application\/json/);
    const body = await scene.text();
    assert.equal(body, content);
    assert.match(body, /data:image\/svg\+xml;base64,/);
    const raw = await fetch(origin + base + asset.source);
    assert.equal(
      raw.status,
      404,
      "The original Markdown drawing must not be served",
    );
    for (const path of [
      "src/runtime/excalidraw.ts",
      "src/runtime/excalidraw-view.ts",
    ]) {
      const module = await fetch(origin + base + path);
      assert.equal(module.status, 200);
      const source = await module.text();
      assert.match(
        source,
        path.endsWith("-view.ts")
          ? /ExcalidrawComponent/
          : /IntersectionObserver/,
      );
      for (const [, dependency] of source.matchAll(
        /(?:from\s*|import\s*)["']([^"']*\/deps\/[^"']+)["']/g,
      )) {
        const imported = await fetch(new URL(dependency, origin + base));
        assert.equal(
          imported.status,
          200,
          "Vite must serve the React/plugin dependencies",
        );
      }
    }
    console.log(
      "Excalidraw dev checks passed: formula SVG in fixture JSON, HTML, source exclusion and lazy Vite modules",
    );
  } finally {
    note.html = original;
    snapshot.assets.splice(snapshot.assets.indexOf(asset), 1);
  }
}
