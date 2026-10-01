import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { renderComponent } from "./helpers/render-astro";

const note = {
  slug: "note",
  source: "note.md",
  url: "/note",
  title: "Note",
  summary: "Summary",
  kind: "article",
  tags: ["topic"],
  date: "2026-10-01",
};
const parse = (html: string) =>
  parseHTML(`<html><body>${html}</body></html>`).document;

test("hover motion is opt-in for updates, tag results and friend cards, never archive stacks", async () => {
  const updates = parse(await renderComponent("Updates", { pages: [note] }));
  assert.equal(
    updates.querySelectorAll(".note-card[data-card-motion]").length,
    1,
  );
  const tags = parse(
    await renderComponent("TagPage", {
      group: { tag: "topic", notes: [note] },
      articleURL: "/articles",
    }),
  );
  assert.equal(tags.querySelectorAll(".note-card[data-card-motion]").length, 1);
  const ordinary = parse(await renderComponent("ArticleCard", { note }));
  assert.equal(ordinary.querySelector("[data-card-motion]"), null);
  const stack = parse(
    await renderComponent("ArticleCard", {
      note,
      stackIndex: 0,
      hoverMotion: true,
    }),
  );
  assert.ok(stack.querySelector(".stack-card"));
  assert.equal(stack.querySelector("[data-card-motion]"), null);
  const friends = [
    { name: "Ada", bio: "A friend", url: "https://ada.example.com/" },
  ];
  const inactive = parse(await renderComponent("FriendCards", { friends }));
  assert.equal(inactive.querySelector("[data-card-motion]"), null);
  const active = parse(
    await renderComponent("FriendCards", { friends, hoverMotion: true }),
  );
  assert.equal(
    active.querySelectorAll(".friend-card[data-card-motion]").length,
    1,
  );
  assert.equal(
    active.querySelector(".friend-main-link")!.getAttribute("href"),
    friends[0].url,
  );
});
