import { visit } from "unist-util-visit";

export function selectEmbedded(
  tree: any,
  anchor: string,
  blocks: Map<string, number>,
): any[] {
  let selected: any[] = tree.children;
  if (anchor.startsWith("block-"))
    selected = [tree.children[blocks.get(anchor.slice(6))!]];
  else if (anchor) {
    const start = tree.children.findIndex(
        (n: any) => n.type === "heading" && n.data?.hProperties?.id === anchor,
      ),
      depth = (tree.children[start] as any)?.depth;
    let end = start + 1;
    while (
      end < tree.children.length &&
      !(
        tree.children[end].type === "heading" &&
        (tree.children[end] as any).depth <= depth
      )
    )
      end++;
    selected = tree.children.slice(start, end);
  }
  // Definitions are document-scoped; carry them alongside selected sections.
  const defs = tree.children.filter(
    (n: any) => n.type === "definition" || n.type === "footnoteDefinition",
  );
  return [...new Set([...selected, ...defs])];
}

export function scopeEmbedIds(nodes: any[], scope: string) {
  for (const child of nodes)
    visit(child, (n: any) => {
      if (n.data?.hProperties?.id)
        n.data.hProperties.id = scope + n.data.hProperties.id;
      if (
        [
          "footnoteDefinition",
          "footnoteReference",
          "definition",
          "linkReference",
          "imageReference",
        ].includes(n.type)
      )
        n.identifier = scope + n.identifier;
    });
}
