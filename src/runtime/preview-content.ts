// Adapted from Quartz's popover previews (MIT, jackyzha0).
// Upstream: quartz/components/scripts/popover.inline.ts, revision 6dd772bf.
// See LICENSES/quartz-popover.txt. Only explicitly marked article content is imported.

export function extractPreviewContent(
  html: string,
  noteId: string,
  pageURL: URL,
  scope: string,
  parser = new DOMParser(),
) {
  const parsed = parser.parseFromString(html, "text/html"),
    article = [
      ...parsed.querySelectorAll<HTMLElement>("article[data-note-id]"),
    ].find((node) => node.dataset.noteId === noteId);
  if (!article) throw new Error("This response is not the requested article");
  const sections = [
    ...article.querySelectorAll<HTMLElement>("[data-preview-content]"),
  ];
  if (!sections.length)
    throw new Error("Article preview content is unavailable");
  const container = parsed.createElement("div");
  container.append(...sections);
  container
    .querySelectorAll(
      "script,iframe,object,embed,base,style,form,.preview-button",
    )
    .forEach((node) => node.remove());
  const ids = new Map<string, string>();
  container.querySelectorAll<HTMLElement>("[id]").forEach((node, index) => {
    const original = node.id;
    node.id = `${scope}-${index}`;
    if (!ids.has(original)) ids.set(original, node.id);
  });
  for (const element of container.querySelectorAll<HTMLElement>("*")) {
    // Fetched content must not initialize another site controller or execute handlers.
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name.startsWith("data-preview") ||
        name === "data-open-preview"
      ) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (
        [
          "aria-labelledby",
          "aria-describedby",
          "aria-controls",
          "for",
        ].includes(name)
      )
        element.setAttribute(
          name,
          attribute.value
            .split(/\s+/)
            .map((id) => ids.get(id) || id)
            .join(" "),
        );
      // MathJax SVG and other fragment references must use the renamed IDs too.
      if (attribute.value.includes("url(#"))
        element.setAttribute(
          attribute.name,
          attribute.value.replace(/url\(#([^)]*)\)/g, (value, id: string) =>
            ids.has(id) ? `url(#${ids.get(id)})` : value,
          ),
        );
      if (!["href", "xlink:href", "src", "poster"].includes(name)) continue;
      const value = attribute.value;
      if (
        (name === "xlink:href" ||
          (name === "href" &&
            element.namespaceURI === "http://www.w3.org/2000/svg")) &&
        value.startsWith("#")
      ) {
        const mapped = ids.get(value.slice(1));
        if (mapped) element.setAttribute(attribute.name, "#" + mapped);
        continue;
      }
      const resolved = new URL(value, pageURL);
      if (!["http:", "https:", "mailto:", "tel:"].includes(resolved.protocol)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      let fragment = "";
      try {
        fragment = decodeURIComponent(resolved.hash.slice(1));
      } catch {
        /* malformed fragment remains an ordinary link */
      }
      if (
        name === "href" &&
        resolved.origin === pageURL.origin &&
        resolved.pathname === pageURL.pathname &&
        ids.has(fragment)
      ) {
        element.setAttribute(name, resolved.href);
        element.setAttribute("data-preview-anchor", ids.get(fragment)!);
      } else element.setAttribute(attribute.name, resolved.href);
    }
    // Image source sets are relative to the fetched page, not the host page.
    // The site renderer emits src; drop authored srcset rather than misresolve candidates.
    element.removeAttribute("srcset");
  }
  return { container, ids };
}

export function createPreviewLoader(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, string>();
  return async (pageURL: URL, signal: AbortSignal, refresh = false) => {
    const key = pageURL.href;
    if (refresh) cache.delete(key);
    if (cache.has(key)) {
      const html = cache.get(key)!;
      cache.delete(key);
      cache.set(key, html);
      return html;
    }
    const response = await fetcher(key, {
      signal,
      credentials: "same-origin",
      redirect: "error",
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("Article preview request failed");
    if (response.url && new URL(response.url).origin !== pageURL.origin)
      throw new Error("Article preview left the site");
    const html = await response.text();
    signal.throwIfAborted();
    cache.set(key, html);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    return html;
  };
}
