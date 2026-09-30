import { inlineTagParts, linkedTagParts, tagPath } from "../inline-tags";

export function renderTaggedText(
  target: HTMLElement,
  text: string,
  tags: readonly string[],
  base = document.body.dataset.root || "/",
) {
  const parts = linkedTagParts(inlineTagParts(text), tags);
  if (!parts.some((part) => part.tag)) {
    target.textContent = text;
    return;
  }
  const doc = target.ownerDocument;
  target.replaceChildren(
    ...parts.map((part) => {
      if (!part.tag) return doc.createTextNode(part.text);
      const link = doc.createElement("a");
      link.className = "inline-tag";
      link.href = (base.endsWith("/") ? base : base + "/") + tagPath(part.tag);
      link.textContent = part.text;
      return link;
    }),
  );
}
