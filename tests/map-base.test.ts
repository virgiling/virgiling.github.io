import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { buildSnapshot } from "../src/content/snapshot";
import { readContent } from "../src/content/read";
import {
  parseMapBase,
  queryMapBase,
  readJourneyMap,
} from "../src/content/map-base";
import {
  coordinates,
  groupPoints,
  markerColor,
  readMapData,
  type MapData,
} from "../src/maps/types";
import type { Diagnostic } from "../src/content/types";
import { renderComponent } from "./helpers/render-astro";
import { parseHTML } from "linkedom";

const base = `formulas:
  dynIcon: 'if(file.inFolder("courses"), "book-open", if(file.hasTag("CCF"), "award", "compass"))'
  dynColor: 'if(file.hasTag("CCF") || file.inFolder("courses"), "#5682a8", "var(--ink)")'
views:
  - type: map
    name: My Journey
    filters:
      and:
        - '!file.inFolder("10-daily")'
        - '!file.inFolder("private")'
    order: [title, formula.dynIcon, formula.dynColor]
    coordinates: note.location
    markerIcon: formula.dynIcon
    markerColor: formula.dynColor
`;
const md = (meta = "", body = "Body") =>
  `---\npublish: true\n${/^title:/m.test(meta) ? "" : "title: Public\n"}${/^location:/m.test(meta) ? "" : 'location: "11, 22"\n'}${meta}---\n${body}`;
async function fixture(
  files: Record<string, string>,
  run: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "notes-map-test-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), body);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("map queries preserve publication gates, formulas, filters and projection", async () => {
  await fixture(
    {
      "My Journey.base": base,
      "article.md": md("tags: [CCF]\nunused: PUBLIC_METADATA_CANARY\n"),
      "courses/a.md": md(),
      "10-daily/excluded.md": md("title: FILTERED_CANARY\n"),
      "unlisted.md": md("unlisted: true\ntitle: UNLISTED_CANARY\n"),
      "private/broken.md": "---\n: broken: yaml:\n---\nPRIVATE_CANARY",
      "secret.md":
        "---\npublish: false\nlocation: '11, 22'\ntitle: PRIVATE_CANARY\n---\n",
      "default.md":
        "---\nlocation: '11, 22'\ntitle: DEFAULT_PRIVATE_CANARY\n---\n",
    },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.journey.status, "ready");
      if (snapshot.journey.status !== "ready") return;
      const data = snapshot.journey.data;
      assert.equal(data.points.length, 2);
      assert.equal(groupPoints(data.points).length, 1);
      const points = new Map(data.points.map((point) => [point.id, point]));
      assert.equal(points.get("article.md")?.icon, "award");
      assert.equal(points.get("courses/a.md")?.icon, "book-open");
      assert.equal(points.get("article.md")?.color, "#5682a8");
      assert.ok(
        !snapshot.diagnostics.some((item) => item.code.startsWith("map-")),
      );
      for (const canary of [
        "UNLISTED_CANARY",
        "PRIVATE_CANARY",
        "DEFAULT_PRIVATE_CANARY",
        "PUBLIC_METADATA_CANARY",
        "FILTERED_CANARY",
        "dynIcon",
        "note.location",
      ])
        assert.ok(!JSON.stringify(data).includes(canary), canary);
      // The adapter defends its own boundary even if a caller supplies all notes.
      const diagnostics: Diagnostic[] = [];
      assert.equal(
        queryMapBase(
          parseMapBase(base),
          snapshot.notes,
          diagnostics,
          "My Journey.base",
        ).points.length,
        2,
      );
    },
  );
});
test("coordinates preserve zero, enforce bounds and reject ambiguous or non-finite values", () => {
  for (const [value, expected] of [
    ["0, 0", [0, 0]],
    [
      [0, 0],
      [0, 0],
    ],
    [
      [90, -180],
      [90, -180],
    ],
    ["-90, 180", [-90, 180]],
    [
      ["11.5", "22"],
      [11.5, 22],
    ],
    [
      [1, 2, 3],
      [1, 2],
    ],
  ])
    assert.deepEqual(coordinates(value), expected);
  for (const value of [
    undefined,
    null,
    false,
    [],
    [1],
    [91, 0],
    [0, 181],
    [Infinity, 0],
    [null, 0],
    [false, 0],
    "",
    " , ",
    "11junk, 22",
    "NaN, 0",
    "1e999, 2",
  ])
    assert.equal(coordinates(value), undefined, String(value));
});
test("empty, unavailable and malformed maps have distinct states and diagnostics", async () => {
  await fixture(
    { "My Journey.base": base, "a.md": md("location: [91, 0]\n") },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.journey.status, "ready");
      if (snapshot.journey.status === "ready")
        assert.equal(snapshot.journey.data.points.length, 0);
      assert.ok(
        snapshot.diagnostics.some((item) => item.code === "map-coordinate"),
      );
    },
  );
  await fixture({ "a.md": md() }, async (root) =>
    assert.equal((await buildSnapshot(root)).journey.status, "unavailable"),
  );
  await fixture(
    {
      "My Journey.base": "views: [{type: table, name: My Journey}]",
      "a.md": md(),
    },
    async (root) => {
      const snapshot = await buildSnapshot(root);
      assert.equal(snapshot.journey.status, "error");
      assert.ok(
        snapshot.diagnostics.some(
          (item) => item.code === "map-base" && item.message.includes("map"),
        ),
      );
    },
  );
});
test("formula dependencies are resolved independently of declarations or display order", async () => {
  const source = `formulas:
  coords: '[formula.latitude, 22]'
  latitude: '11'
  color: '"#123456"'
views:
  - type: map
    coordinates: formula.coords
    markerColor: formula.color
    order: [formula.color, title]
`;
  await fixture({ "a.md": md() }, async (root) => {
    const snapshot = await buildSnapshot(root),
      diagnostics: Diagnostic[] = [];
    const data = queryMapBase(
      parseMapBase(source),
      snapshot.notes,
      diagnostics,
      "Test.base",
    );
    assert.deepEqual(data.points[0].coordinates, [11, 22]);
    assert.equal(data.points[0].color, "#123456");
    assert.deepEqual(diagnostics, []);
  });
});
test("file lookup and inline tag predicates cannot reveal unpublished or unlisted notes", async () => {
  await fixture(
    {
      "a.md": md("", "Tagged #CCF"),
      "hidden.md": md("unlisted: true\n"),
      "secret.md": "---\npublish: false\n---\n",
    },
    async (root) => {
      const snapshot = await buildSnapshot(root),
        diagnostics: Diagnostic[] = [];
      // Quartz's file() constructs path values; asFile() hydrates from our public-only lookup.
      const query = `filters: '"hidden.md".asFile().properties.isEmpty() && "secret.md".asFile().properties.isEmpty() && "a.md".asFile().properties.location == "11, 22" && file.hasTag("CCF")'
views: [{type: map, coordinates: note.location}]`;
      assert.equal(
        queryMapBase(
          parseMapBase(query),
          snapshot.notes,
          diagnostics,
          "Test.base",
        ).points.length,
        1,
      );
    },
  );
});
test("malformed YAML, filters, views, calls and formula cycles are not silently empty", () => {
  for (const source of [
    "views: [\n",
    "views: []",
    "views: [{type: map}]",
    "views: [{type: cards}]",
    "views: [{type: map, coordinates: note.location}]\nfilters: {and: wrong}",
    "views: [{type: map, coordinates: note.location}]\nfilters: 'doesNotExist()'",
    "views: [{type: map, coordinates: note.location}]\nfilters: 'file.wrongMethod()'",
    "views: [{type: map, coordinates: formula.missing}]",
    `formulas: {a: 'formula.b', b: 'formula.a'}\nviews: [{type: map, coordinates: formula.a}]`,
    `formulas: {a: 'formula.missing'}\nviews: [{type: map, coordinates: formula.a}]`,
    `formulas: {a: 'if('}\nviews: [{type: map, coordinates: note.location}]`,
    "views: [{type: map, coordinates: note.location}]\nviews: []",
  ])
    assert.throws(() => parseMapBase(source), source);
  assert.throws(() => parseMapBase(base, "Not present"));
});
test("center, zoom, height and raster URL configuration is validated", async () => {
  await fixture({ "a.md": md() }, async (root) => {
    const { notes } = await buildSnapshot(root),
      diagnostics: Diagnostic[] = [];
    const source = `views:
  - type: map
    coordinates: note.location
    center: '[0, 0]'
    defaultZoom: 4
    minZoom: 1
    maxZoom: 16
    mapHeight: 350
    mapTiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']
`;
    const data = queryMapBase(
      parseMapBase(source),
      notes,
      diagnostics,
      "Test.base",
    );
    assert.deepEqual(data.center, [0, 0]);
    assert.equal(data.zoom, 4);
    assert.equal(data.height, 350);
    for (const extra of [
      "center: wrong()",
      "defaultZoom: 999",
      "minZoom: 21",
      "maxZoom: -1",
      "mapHeight: 0",
      "mapTiles: ['https://tiles.example/style.json']",
      "mapTiles: ['javascript:alert(1)']",
    ])
      assert.throws(
        () =>
          queryMapBase(
            parseMapBase(
              `views:\n  - type: map\n    coordinates: note.location\n    ${extra}\n`,
            ),
            notes,
            [],
            "Test.base",
          ),
        extra,
      );
  });
});
test("Base file loading retains the safe-path, hard-ignore and symlink boundary", async () => {
  await fixture(
    { "a.md": md(), "private/My Journey.base": base, "safe.base": base },
    async (root) => {
      const snapshot = await buildSnapshot(root),
        { files } = await readContent(root),
        diagnostics: Diagnostic[] = [];
      assert.equal(
        (
          await readJourneyMap(
            root,
            files,
            snapshot.notes,
            diagnostics,
            "private/My Journey.base",
          )
        ).status,
        "unavailable",
      );
      assert.equal(
        (
          await readJourneyMap(
            root,
            files,
            snapshot.notes,
            diagnostics,
            "../escape.base",
          )
        ).status,
        "error",
      );
      await symlink(join(root, "safe.base"), join(root, "linked.base"));
      await assert.rejects(buildSnapshot(root), /Symbolic links/);
    },
  );
});
test("map payload rejects unsafe URLs and marker styling, while retaining valid scalar data", () => {
  assert.equal(
    markerColor("red; background:url(https://evil.test)"),
    "#75665a",
  );
  assert.equal(markerColor("var(--ink)"), "var(--ink)");
  const data: MapData = {
    name: "Test",
    points: [
      {
        id: "a.md",
        title: "<img src=x onerror=alert(1)>",
        url: "/a",
        coordinates: [0, 0],
        icon: "constructor",
        color: "red",
      },
    ],
    minZoom: 0,
    maxZoom: 18,
    height: 400,
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OSM",
  };
  assert.deepEqual(readMapData(JSON.stringify(data)).points, data.points);
  for (const url of [
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "/\nevil.test",
  ])
    assert.throws(() =>
      readMapData(
        JSON.stringify({ ...data, points: [{ ...data.points[0], url }] }),
      ),
    );
});
test("Astro output shows only the map, safely projects popup data and defers native animation-free host", async () => {
  const data: MapData = {
    name: "Test",
    points: [
      {
        id: "a.md",
        title: '\"><img src=x onerror=alert(1)>',
        url: "/a",
        coordinates: [0, 0],
        icon: "map-pin",
        color: "#123456",
      },
    ],
    minZoom: 0,
    maxZoom: 18,
    height: 400,
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OSM",
  };
  const html = await renderComponent("MapView", { data });
  const { document } = parseHTML(html);
  const host = document.querySelector("astro-leaflet[data-defer]")!;
  assert.ok(host);
  const options = JSON.parse(host.getAttribute("data-options")!).mapOptions;
  assert.equal(options.touchZoom, true);
  assert.equal(options.zoomSnap, 0);
  assert.equal(options.bounceAtZoomLimits, false);
  assert.ok(document.querySelector("noscript"));
  assert.equal(
    document.querySelector(".map-summary,.map-notes,[data-map-point],img"),
    null,
  );
  assert.ok(!html.includes("篇公开笔记") && !html.includes("笔记列表"));
  const projected = readMapData(
    document.querySelector<HTMLElement>("[data-map]")!.dataset.map!,
  );
  assert.equal(projected.points[0].title, data.points[0].title);
  assert.equal(projected.points[0].url, "/a");
  for (const setting of [
    "zoomAnimation",
    "fadeAnimation",
    "markerZoomAnimation",
    "inertia",
    "scrollWheelZoom",
  ])
    assert.match(html, new RegExp(`${setting}(?:&quot;|\")?:false`));
});
