import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { renderComponent } from "./helpers/render-astro";
import { readSiteStyles } from "./helpers/styles";

test("desktop and mobile outlines preserve authored depths and indent relative to the shallowest heading", async () => {
  for (const depths of [
    [1, 2, 3, 2, 1, 2],
    [2, 3, 2],
    [1, 3],
    [3, 3],
  ]) {
    const headings = depths.map((depth, index) => ({
      id: `h-${index}`,
      text: `Heading ${index}`,
      depth,
      trail: [],
    }));
    for (const mobile of [false, true]) {
      const { document } = parseHTML(
        await renderComponent("OnThisPage", { headings, mobile }),
      );
      const items = [...document.querySelectorAll(".toc li")];
      assert.equal(items.length, headings.length);
      items.forEach((item, index) => {
        const indent = (depths[index] - Math.min(...depths)) * 20;
        assert.equal(item.getAttribute("data-depth"), String(depths[index]));
        assert.equal(item.classList.contains("toc-child"), indent > 0);
        assert.equal(
          (item as HTMLElement).style.getPropertyValue("--toc-indent").trim(),
          `${indent}px`,
        );
        assert.equal(
          item.querySelector(".toc-entry")?.getAttribute("data-heading"),
          headings[index].id,
        );
        assert.equal(
          item.querySelector("a")?.getAttribute("href"),
          `#${headings[index].id}`,
        );
      });
    }
  }
});

test("outline depth filtering and empty outlines retain the existing contract", async () => {
  for (const depths of [[], [4, 5, 6], [2, 4, 3]]) {
    const headings = depths.map((depth, index) => ({
      id: `h-${index}`,
      text: `Heading ${index}`,
      depth,
      trail: [],
    }));
    const { document } = parseHTML(
      await renderComponent("OnThisPage", { headings }),
    );
    assert.deepEqual(
      [...document.querySelectorAll(".toc li")].map((item) =>
        Number(item.getAttribute("data-depth")),
      ),
      depths.filter((depth) => depth <= 3),
    );
  }
});

test("outline indentation and child typography do not depend on an absolute h3 depth", async () => {
  const root = await readSiteStyles();
  const rules: Record<string, Record<string, string>> = {};
  root.walkRules((rule) => {
    assert.doesNotMatch(
      rule.selector,
      /\.toc.*data-depth/,
      "absolute heading depths must not determine outline indentation",
    );
    const declarations: Record<string, string> = {};
    rule.walkDecls((decl) => {
      declarations[decl.prop] = decl.value;
    });
    rules[rule.selector] = { ...rules[rule.selector], ...declarations };
  });
  assert.equal(rules[".toc-entry"]["margin-left"], "var(--toc-indent)");
  assert.ok(rules[".toc-child .toc-entry"]);
  assert.ok(rules[".outline-dialog .toc-child .toc-entry"]);
  const childGuide = root.nodes
    .flatMap((node) =>
      node.type === "rule" && node.selector === ".toc-child .toc-entry:after"
        ? [node.toString()]
        : [],
    )
    .join("\n");
  assert.match(childGuide, /left-\[-6px\]/);
});
