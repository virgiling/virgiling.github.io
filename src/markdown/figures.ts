import type { Root, Nodes, Element, ElementContent } from "hast";

// Explicit italic caption only; alt remains accessibility text.
const significant = (nodes: ElementContent[] = []) =>
  nodes.filter(
    (node) =>
      !(node.type === "text" && !node.value.trim()) &&
      !(node.type === "element" && node.tagName === "br"),
  );
const isElement = <Tag extends string>(
  node: Nodes | undefined,
  tag: Tag,
): node is Element & { tagName: Tag } =>
  node?.type === "element" && node.tagName === tag;
function isImage(node: ElementContent | undefined): node is Element {
  return (
    isElement(node, "img") ||
    (isElement(node, "a") &&
      significant(node.children).length === 1 &&
      isElement(significant(node.children)[0], "img"))
  );
}
function caption(node: Nodes | undefined): Element | null {
  if (!isElement(node, "p")) return null;
  const children = significant(node.children);
  return children.length === 1 && isElement(children[0], "em")
    ? children[0]
    : null;
}
export function rehypeFigures() {
  return function walk(node: Nodes): void {
    if (
      !("children" in node) ||
      (node.type === "element" &&
        ["figure", "pre", "code"].includes(node.tagName))
    )
      return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const parts = isElement(child, "p") ? significant(child.children) : [];
      let text: Element | null = null,
        end = i;
      if (isImage(parts[0])) {
        if (parts.length === 2 && isElement(parts[1], "em")) text = parts[1];
        else if (parts.length === 1) {
          let j = i + 1,
            next = node.children[j];
          while (next?.type === "text" && !next.value.trim())
            next = node.children[++j];
          text = caption(next);
          if (text) end = j;
        }
      }
      if (text) {
        node.children.splice(i, end - i + 1, {
          type: "element",
          tagName: "figure",
          properties: {},
          children: [
            parts[0],
            {
              type: "element",
              tagName: "figcaption",
              properties: {},
              children: text.children,
            },
          ],
        });
      } else walk(child);
    }
  };
}
// Reconcile sanitized fragment/ARIA references without disabling ID protection.
export function rehypeFragmentTargets() {
  return (tree: Root) => {
    const ids = new Set<string>(),
      nodes: Element[] = [];
    function visit(node: Nodes) {
      if (node.type === "element") {
        nodes.push(node);
        if (node.properties.id) ids.add(String(node.properties.id));
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(tree);
    const target = (id: string) =>
      ids.has(id)
        ? id
        : ids.has("user-content-" + id)
          ? "user-content-" + id
          : id;
    for (const node of nodes) {
      const props = node.properties;
      if (typeof props.href === "string" && props.href.startsWith("#")) {
        try {
          props.href =
            "#" +
            encodeURIComponent(target(decodeURIComponent(props.href.slice(1))));
        } catch {
          /* Keep malformed fragments as text. */
        }
      }
      for (const key of ["ariaDescribedBy", "ariaLabelledBy"]) {
        const value = props[key];
        if (value)
          props[key] = (
            Array.isArray(value) ? value : String(value).split(/\s+/)
          ).map((id) => target(String(id)));
      }
    }
  };
}
