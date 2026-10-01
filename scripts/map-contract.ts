import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { readMapData, groupPoints } from "../src/maps/types";
export function verifyMapHTML(source: string, base: string) {
  const { document } = parseHTML(source);
  const sections = document.querySelectorAll<HTMLElement>("[data-map]");
  assert.equal(
    sections.length,
    1,
    "Journey must render its configured discovery map",
  );
  const section = sections[0],
    data = readMapData(section.dataset.map!);
  assert.equal(
    section.querySelector(".map-summary,.map-notes,[data-map-point]"),
    null,
    "Journey shows only the map",
  );
  const host = section.querySelector("astro-leaflet[data-defer]");
  assert.ok(host, "Map engine is deferred");
  const options: unknown = JSON.parse(host.getAttribute("data-options")!);
  assert.ok(options && typeof options === "object" && "mapOptions" in options);
  const flags = options.mapOptions;
  assert.ok(flags && typeof flags === "object");
  for (const key of [
    "zoomAnimation",
    "fadeAnimation",
    "markerZoomAnimation",
    "inertia",
    "scrollWheelZoom",
  ])
    assert.equal(
      Reflect.get(flags, key),
      false,
      `${key}: no native interpolation or scroll hijacking`,
    );
  assert.equal(
    Reflect.get(flags, "touchZoom"),
    true,
    "Touchscreen pinch must zoom the map",
  );
  assert.equal(
    Reflect.get(flags, "zoomSnap"),
    0,
    "Pinch must support fractional zoom updates",
  );
  assert.equal(
    Reflect.get(flags, "bounceAtZoomLimits"),
    false,
    "Pinch bounds must not add native rebound animation",
  );
  for (const point of data.points)
    assert.ok(point.url.startsWith(base), point.url);
  return data;
}
// Compile actual Vite HTTP ESM, including optimized imports and the stylesheet
// module. No Leaflet execution, third-party tile requests, browser or rendering.
export async function verifyDevMap(origin: string, base: string) {
  const responses: Array<{
    url: string;
    status: number;
    type: string | null;
    bytes: number;
  }> = [];
  const stylesheets = new Set<string>();
  async function get(path: string) {
    const url = new URL(path, origin).href;
    assert.equal(new URL(url).origin, origin);
    const response = await fetch(url, {
      headers: { Accept: "text/javascript" },
      signal: AbortSignal.timeout(15000),
    });
    const source = await response.text();
    responses.push({
      url,
      status: response.status,
      type: response.headers.get("content-type"),
      bytes: Buffer.byteLength(source),
    });
    assert.equal(response.status, 200, url);
    if (
      new URL(url).searchParams.has("url") &&
      new URL(url).pathname.endsWith(".css")
    ) {
      const asset = /export default\s+(["'][^"']+["'])/.exec(source);
      assert.ok(asset, "Vite must expose the deferred Leaflet stylesheet URL");
      stylesheets.add(JSON.parse(asset[1]));
    }
    return source;
  }
  const data = verifyMapHTML(await get(base + "journey"), base);
  await build({
    stdin: {
      contents: `export * from ${JSON.stringify(origin + base + "src/runtime/maps.ts")}; export * from ${JSON.stringify(origin + base + "src/runtime/map-view.ts")};`,
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    plugins: [
      {
        name: "actual-http-map-modules",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            const url = new URL(
              args.path,
              args.namespace === "http-map" ? args.importer : origin,
            ).href;
            assert.equal(new URL(url).origin, origin);
            return { path: url, namespace: "http-map" };
          });
          builder.onLoad(
            { filter: /.*/, namespace: "http-map" },
            async (args) => ({ contents: await get(args.path), loader: "js" }),
          );
        },
      },
    ],
  });
  assert.equal(
    stylesheets.size,
    1,
    "Map must expose one deferred vendor stylesheet",
  );
  for (const path of stylesheets) {
    const url = new URL(path, origin);
    url.searchParams.set("direct", "");
    const css = await get(url.href);
    assert.match(responses.at(-1)!.type ?? "", /text\/css/);
    assert.ok(
      css.includes(".leaflet-pane"),
      "Fetch the actual CSS asset, not only its URL module",
    );
  }
  assert.ok(
    !responses.some((response) => response.url.includes("bases-page")),
    "Expression engine must stay on the build side",
  );
  const result = {
    status: "passed",
    base,
    points: data.points.length,
    places: groupPoints(data.points).length,
    modules: responses.length - 1,
    scope:
      "HTTP-served map projection and actual Vite dependency compilation; no browser, layout or tiles",
  };
  await mkdir(".astro/reports", { recursive: true });
  await writeFile(
    `.astro/reports/dev-map-${base === "/" ? "root" : "base"}.json`,
    JSON.stringify({ ...result, responses }, null, 2),
  );
  return result;
}
