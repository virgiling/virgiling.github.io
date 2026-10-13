import type { Nodes, Root } from "mdast";

function text(node: Nodes): string {
  if (
    node.type === "html" ||
    node.type === "image" ||
    node.type === "imageReference"
  )
    return "";
  if ("value" in node) return node.value;
  if ("children" in node)
    return node.children.map(text).join(node.type === "paragraph" ? "" : " ");
  return "";
}
function clean(value: string) {
  return value
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(
      /!?\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
      (_, target: string, alias?: string) => alias || target,
    )
    .replace(/\[![\w-]+\][+-]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function shorten(value: string, limit = 100) {
  const chars = [...value];
  if (chars.length <= limit) return value;
  const prefix = chars.slice(0, limit).join("");
  const ends = [...prefix.matchAll(/[。！？]|[.!?](?=\s|$)/g)];
  const last = ends.at(-1);
  return last ? prefix.slice(0, last.index! + 1) : prefix.trimEnd() + "…";
}
export function noteSummary(tree: Root, description: string, title: string) {
  // Authored descriptions retain their length; the limit applies to extraction.
  if (clean(description)) return clean(description);
  let abstract = "";
  function find(node: Nodes) {
    if (abstract) return;
    if (
      node.type === "blockquote" &&
      node.data?.hProperties?.dataCalloutMarker === "1"
    ) {
      const first = node.children[0];
      if (
        first?.type === "paragraph" &&
        /^\[!(?:abstract|summary|tldr)\][+-]?(?:\s|$)/i.test(text(first))
      ) {
        // The entire first line is the Callout's title, not its summary body.
        abstract = clean(
          [
            text(first).split(/\r?\n/).slice(1).join(" "),
            ...node.children
              .slice(1)
              .filter((n) => n.type === "paragraph")
              .map(text),
          ].join(" "),
        );
        if (abstract) return;
      }
    }
    if ("children" in node) node.children.forEach(find);
  }
  find(tree);
  const paragraph = tree.children.find(
    (node) => node.type === "paragraph" && clean(text(node)),
  );
  return shorten(
    abstract || (paragraph ? clean(text(paragraph)) : "") || clean(title),
  );
}
