import { build } from "esbuild";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { drawingScene } from "../src/content/drawing-scene";
import { drawingMarkdown, rectangle } from "../tests/helpers/drawings";

// Static dependency sizes and Node-side decoding only. Browser execution,
// Canvas, font fetches and scene-dependent dynamic imports are not measured.
const directory = resolve("dist/_astro");
const files = (await readdir(directory))
  .filter((file) => file.endsWith(".js"))
  .map((file) => resolve(directory, file));
const entry = files.find((file) => /\/excalidraw-view\.[\w-]+\.js$/.test(file));
if (!entry) throw new Error("Build the site before measuring Excalidraw");
const graph = await build({
  entryPoints: files,
  bundle: true,
  write: false,
  metafile: true,
  outdir: resolve(".astro/reports/unused"),
  logLevel: "silent",
});
const inputs = new Map(
  Object.entries(graph.metafile!.inputs).map(([path, input]) => [
    resolve(path),
    input,
  ]),
);
function closure(roots: string[]) {
  const seen = new Set<string>();
  function visit(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    for (const item of inputs.get(path)?.imports || [])
      if (!item.external && item.kind === "import-statement")
        visit(resolve(item.path));
  }
  roots.forEach(visit);
  return [...seen];
}
const wrapper = closure([entry]);
const exporterRoots = wrapper.flatMap((path) =>
  (inputs.get(path)?.imports || [])
    .filter((item) => !item.external && item.kind === "dynamic-import")
    .map((item) => resolve(item.path)),
);
const firstDrawing = closure([...wrapper, ...exporterRoots]);
async function sizes(paths: string[]) {
  const entries = await Promise.all(
    paths.map(async (path) => {
      const buffer = await readFile(path);
      return {
        file: relative(resolve("dist"), path),
        bytes: buffer.length,
        gzipBytes: gzipSync(buffer).length,
      };
    }),
  );
  return {
    bytes: entries.reduce((n, file) => n + file.bytes, 0),
    gzipBytes: entries.reduce((n, file) => n + file.gzipBytes, 0),
    files: entries,
  };
}
const decode: {
  elements: number;
  sourceBytes: number;
  sceneBytes: number;
  medianDecodeMs: number;
}[] = [];
for (const count of [10, 100, 1000]) {
  const markdown = drawingMarkdown({
    type: "excalidraw",
    elements: Array.from({ length: count }, (_, i) => ({
      ...rectangle,
      id: `shape-${i}`,
      x: i * 10,
    })),
    files: {},
  });
  drawingScene(markdown, true);
  const samples: number[] = [];
  let content = "";
  for (let i = 0; i < 15; i++) {
    const start = performance.now();
    content = drawingScene(markdown, true);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  decode.push({
    elements: count,
    sourceBytes: Buffer.byteLength(markdown),
    sceneBytes: Buffer.byteLength(content),
    medianDecodeMs: Number(samples[7].toFixed(3)),
  });
}
const report = {
  measured:
    "Production JS static closures and synthetic compressed scene decoding, not browser performance",
  wrapper: await sizes(wrapper),
  firstDrawingStaticClosure: await sizes(firstDrawing),
  additionalDynamicImports: [
    ...new Set(
      firstDrawing.flatMap((path) =>
        (inputs.get(path)?.imports || [])
          .filter(
            (item) =>
              !item.external &&
              item.kind === "dynamic-import" &&
              !firstDrawing.includes(resolve(item.path)),
          )
          .map((item) => relative(resolve("dist"), resolve(item.path))),
      ),
    ),
  ],
  emittedJsTotal: await sizes(files),
  decode,
};
await mkdir(".astro/reports/remark-excalidraw", { recursive: true });
await writeFile(
  ".astro/reports/remark-excalidraw/dependency-metrics.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      firstDrawingStaticJsBytes: report.firstDrawingStaticClosure.bytes,
      firstDrawingStaticJsGzipBytes: report.firstDrawingStaticClosure.gzipBytes,
      additionalDynamicModules: report.additionalDynamicImports.length,
      emittedJsBytes: report.emittedJsTotal.bytes,
      emittedJsGzipBytes: report.emittedJsTotal.gzipBytes,
      decode,
    },
    null,
    2,
  ),
);
