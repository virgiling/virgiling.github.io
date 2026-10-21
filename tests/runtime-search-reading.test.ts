import assert from "node:assert/strict";
import { test } from "node:test";
import { Element, environment } from "./helpers/runtime-bundle";

test("reading position skips closed callout headings and anchor reveal opens only closed ancestors", () => {
  const runtime = environment();
  assert.equal(runtime.visibleHeadingIndex([100, null, 500], 300), 0);
  assert.equal(runtime.visibleHeadingIndex([100, 500, null], 900, true), 1);
  assert.equal(runtime.visibleHeadingIndex([null, null], 900, true), -1);
  assert.equal(runtime.visibleHeadingIndex([null, 100], 0), 1);
  const parents = [{ open: false }, { open: false }];
  const target = { closest: () => parents.find((n) => !n.open) };
  assert.equal(runtime.revealCalloutAncestors(target), true);
  assert.ok(parents.every((n) => n.open));
  assert.equal(runtime.revealCalloutAncestors(target), false);
  assert.equal(runtime.revealCalloutAncestors({ closest: () => null }), false);
});

test("tag URL opens search with the filter applied, lazy-loads once and renders text-safe results", async () => {
  const ids = [
    "search-dialog",
    "search-input",
    "search-results",
    "search-count",
    "open-search",
    "close-search",
  ];
  class Document extends EventTarget {
    activeElement: Element | null = null;
    querySelector!: (selector: string) => Element;
    createElement!: (tag: string) => Element;
    body!: { dataset: { searchIndex: string } };
  }
  const document = new Document(),
    nodes = Object.fromEntries(ids.map((id) => ["#" + id, new Element()]));
  function element(tag: string) {
    const e = new Element();
    e.tagName = tag;
    e.children = [];
    e.setAttribute = () => {};
    e.append = (...children) => e.children.push(...children);
    e.replaceChildren = () => {
      e.children = [];
    };
    e.remove = () => {};
    return e;
  }
  const results = (nodes["#search-results"] = element("ul")),
    dialog = nodes["#search-dialog"],
    input = nodes["#search-input"];
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
  };
  input.focus = () => {
    document.activeElement = input;
  };
  document.querySelector = (selector) => nodes[selector];
  document.createElement = element;
  let loads = 0;
  document.body = { dataset: { searchIndex: "/preview/data/search.json" } };
  const records = [
    {
      title: "<COW>",
      url: "/preview/articles/os",
      tags: ["主题/操作系统"],
      summary: "safe",
    },
    { title: "Other", url: "/preview/articles/other", tags: ["工具/Obsidian"] },
  ];
  class Worker {
    onmessage!: (event: {
      data: { id: number; records: typeof records };
    }) => void;
    constructor() {
      loads++;
    }
    postMessage({
      id,
      url,
      query,
    }: {
      id: number;
      url: string;
      query: string;
    }) {
      assert.equal(url, "https://example.test/preview/data/search.json");
      queueMicrotask(() =>
        this.onmessage({
          data: { id, records: query ? records.slice(0, 1) : records },
        }),
      );
    }
    terminate() {}
  }
  const runtime = environment({
    document,
    URL,
    Worker,
    location: {
      href: "https://example.test/preview/",
      search: "?tag=" + encodeURIComponent("主题/操作系统"),
    },
    getComputedStyle: (e: Element) => ({
      opacity: e.style.opacity || "1",
      transform: e.style.transform || "none",
    }),
  });
  runtime.initSearch({ prefix: "", beforeOpen: () => {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dialog.open, true);
  assert.equal(input.value, "#主题/操作系统");
  assert.equal(results.children.length, 1);
  assert.equal(
    results.children[0].children[0].children[2].children[0].textContent,
    "<COW>",
  );
  nodes["#open-search"].click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(input.value, "");
  assert.equal(results.children.length, 2);
  assert.equal(loads, 1);
});
