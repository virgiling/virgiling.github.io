import { esc } from "./shared.mjs";
import { HomeActivity } from "./home-activity.mjs";
import { LocalGraph } from "./graph.mjs";
export function readingMinutes(note, config) {
  const text = note.readingText || note.plainText,
    cjk = (
      text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ||
      []
    ).length;
  const words = (
    text
      .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, " ")
      .match(/[\p{L}\p{N}]+/gu) || []
  ).length;
  return Math.max(
    1,
    Math.ceil(cjk / config.cjkPerMinute + words / config.wordsPerMinute),
  );
}
const dateText = (value) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
export function ReadingMeta(n, config) {
  return `<div class="reading-meta">${n.date ? `<span><span class="meta-icon" aria-hidden="true">✏️</span>Published <time datetime="${esc(n.date)}">${dateText(n.date)}</time></span>` : ""}${n.updated ? `<span><span class="meta-icon" aria-hidden="true">🔧</span>Last updated <time datetime="${esc(n.updated)}">${dateText(n.updated)}</time></span>` : ""}<span class="read-time">${readingMinutes(n, config.reading)} min read</span></div>`;
}
export function relations(n, pages) {
  const incoming = pages.filter((x) => x.links.includes(n.slug));
  const connected = [...new Set([...n.links, ...incoming.map((x) => x.slug)])]
    .map((id) => pages.find((x) => x.slug === id))
    .filter(Boolean);
  return { incoming, connected };
}
export function OnThisPage(headings, { mobile = false } = {}) {
  return `<nav class="on-this-page" aria-label="${mobile ? "移动端 " : ""}ON THIS PAGE"><h2 class="side-title">ON THIS PAGE</h2><div class="toc-scroll"><div class="toc-track"><span class="toc-marker" aria-hidden="true" hidden></span><ol class="toc">${headings
    .filter((h) => h.depth <= 3)
    .map(
      (h) =>
        `<li data-depth="${h.depth}"><a href="#${encodeURIComponent(h.id)}" data-heading="${esc(h.id)}">${esc(h.text)}</a></li>`,
    )
    .join("")}</ol></div></div></nav>`;
}
export function ReadingSidebar(n, pages, p, config) {
  const { incoming, connected } = relations(n, pages),
    home = n.source === "index.md";
  const backlinks = `<section class="side-section"><h2 class="side-title">反向链接 <small>${incoming.length}</small></h2>${incoming.length ? `<ul class="backlinks">${incoming.map((x) => `<li><a href="${esc(x.url)}" data-preview="${esc(x.slug)}">↗ ${esc(x.title)}</a></li>`).join("")}</ul>` : '<p class="side-empty">暂无反向链接。</p>'}</section>`;
  return `<aside class="sidebar${home ? " home-sidebar" : ""}" aria-label="阅读辅助">${home ? HomeActivity(pages, config.home) : ""}${LocalGraph(n.unlisted ? { ...n, tags: [] } : n, connected)}<section class="side-section">${OnThisPage(n.headings)}</section>${home ? "" : backlinks}</aside>`;
}
