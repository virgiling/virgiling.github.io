import { esc, tagURL } from "./shared.mjs";
// One card component for the folder archive and tag results; no covers or fake dates.
export function ArticleCard(
  note,
  { depth = 3, prefix = "", stackIndex = null } = {},
) {
  const tags = [...new Set(note.tags || [])],
    date = note.date
      ? `<span class="card-created">创作时间 <time datetime="${esc(note.date)}">${esc(note.date.slice(0, 10))}</time></span>`
      : "";
  const headerDate = tags.length > 3,
    stack = stackIndex !== null;
  const tagList = tags.length
    ? `<div class="card-tags" aria-label="文章标签">${tags.map((tag) => `<a class="tag" href="${tagURL(tag, prefix)}">${esc(tag)}</a>`).join("")}</div>`
    : "";
  const footer = (headerDate ? "" : date) + tagList;
  return `<article class="note-card${stack ? " stack-card" : ""}" data-note="${esc(note.slug)}"${stack ? ` style="--i:${Math.min(stackIndex, 2)};z-index:${Math.max(1, 100 - stackIndex)}"` : ""}><a class="card-content${stack ? "" : " tag-result-title"}" href="${esc(prefix + note.url)}" aria-label="${esc(note.title)}"><div class="card-title-row"><h${depth}>${esc(note.title)}</h${depth}>${headerDate ? date : ""}</div><p class="card-description">${esc(note.summary)}</p></a>${footer ? `<footer class="card-footer">${footer}</footer>` : ""}${stack && stackIndex ? `<span class="ghost-title" aria-hidden="true">↳ ${esc(note.title)}</span>` : ""}</article>`;
}
