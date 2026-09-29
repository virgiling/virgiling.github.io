// Fixed HAST transform: explicit italic caption only; alt remains accessibility text.
const significant = (nodes) =>
  (nodes || []).filter(
    (n) => !(n.type === "text" && !n.value.trim()) && n.tagName !== "br",
  );
const isImage = (node) =>
  node?.tagName === "img" ||
  (node?.tagName === "a" &&
    significant(node.children).length === 1 &&
    significant(node.children)[0].tagName === "img");
const caption = (node) =>
  node?.tagName === "p" &&
  significant(node.children).length === 1 &&
  significant(node.children)[0].tagName === "em"
    ? significant(node.children)[0]
    : null;
export function rehypeFigures() {
  return function walk(node) {
    if (!node.children || ["figure", "pre", "code"].includes(node.tagName))
      return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i],
        parts = child.tagName === "p" ? significant(child.children) : [];
      let text = null,
        end = i;
      if (isImage(parts[0])) {
        if (parts.length === 2 && parts[1].tagName === "em") text = parts[1];
        else if (parts.length === 1) {
          let j = i + 1;
          while (
            node.children[j]?.type === "text" &&
            !node.children[j].value.trim()
          )
            j++;
          text = caption(node.children[j]);
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
// Sanitization prefixes IDs against DOM clobbering. Reconcile fragment/ARIA
// references after sanitizing rather than disabling that protection for footnotes.
export function rehypeFragmentTargets() {
  return (tree) => {
    const ids = new Set(),
      nodes = [];
    function visit(node) {
      if (node.type === "element") {
        nodes.push(node);
        if (node.properties?.id) ids.add(node.properties.id);
      }
      node.children?.forEach(visit);
    }
    visit(tree);
    const target = (id) =>
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
          /* Preserve malformed fragments as text, never execute them. */
        }
      }
      for (const key of ["ariaDescribedBy", "ariaLabelledBy"])
        if (props[key])
          props[key] = (
            Array.isArray(props[key])
              ? props[key]
              : String(props[key]).split(/\s+/)
          ).map(target);
    }
  };
}
