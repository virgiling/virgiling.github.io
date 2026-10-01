export interface InlineTagPart {
  text: string;
  tag?: string;
}

// Shared by the Markdown compiler, Astro views and browser-created text.
// Tags are case-sensitive, may be nested, and cannot consist only of numbers.
export function inlineTagParts(text: string, source = text): InlineTagPart[] {
  const protectedRanges = [
    ...text.matchAll(
      /(`+)[\s\S]*?\1|!?\[\[[^\]]*\]\]|!?\[[^\]]*\]\([^)]*\)|(?:[a-z][\w+.-]*:\/\/|mailto:|www\.)[^\s<>]+/gi,
    ),
  ].map((match) => [match.index, match.index + match[0].length]);
  const parts: InlineTagPart[] = [];
  const pattern = /#([\p{L}\p{M}\p{N}_-]+(?:\/[\p{L}\p{M}\p{N}_-]+)*)/gu;
  let cursor = 0,
    sourceCursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index,
      value = match[0],
      rawIndex = source === text ? start : source.indexOf(value, sourceCursor);
    if (rawIndex >= 0) sourceCursor = rawIndex + value.length;
    let slashes = 0;
    for (let i = rawIndex - 1; i >= 0 && source[i] === "\\"; i--) slashes++;
    if (
      rawIndex < 0 ||
      slashes % 2 ||
      (start > 0 &&
        !/[\s([{"'“‘（【《，。！？；：、=*>]/u.test(text[start - 1])) ||
      !/[\p{L}_]/u.test(match[1]) ||
      protectedRanges.some(([a, b]) => start >= a && start < b)
    )
      continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: value, tag: match[1].normalize("NFC") });
    cursor = start + value.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function sliceTagParts(
  parts: InlineTagPart[],
  start: number,
  end: number,
) {
  const result: InlineTagPart[] = [];
  let offset = 0;
  for (const part of parts) {
    const next = offset + part.text.length;
    if (offset < end && next > start)
      result.push({
        text: part.text.slice(Math.max(0, start - offset), end - offset),
        ...(part.tag && start <= offset && end >= next
          ? { tag: part.tag }
          : {}),
      });
    offset = next;
  }
  return result;
}

export function tagPath(tag: string) {
  return (
    "tags/" +
    [...new TextEncoder().encode(tag.normalize("NFC"))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Navigation targets include mentions; classification consumers must use tags only.
export function linkableTags(note: {
  tags?: readonly string[];
  tagMentions?: readonly string[];
}) {
  return [...new Set([...(note.tags || []), ...(note.tagMentions || [])])];
}

export function tagAncestors(tags: readonly string[]) {
  return new Set(
    tags.flatMap((tag) => {
      const parts = tag.split("/").filter(Boolean);
      return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
    }),
  );
}

export function linkedTagParts(
  parts: InlineTagPart[],
  tags?: readonly string[],
  enabled = true,
): InlineTagPart[] {
  const allowed = tags && tagAncestors(tags);
  const result: InlineTagPart[] = [];
  for (const part of parts) {
    const tag =
      enabled && part.tag && (!allowed || allowed.has(part.tag))
        ? part.tag
        : undefined;
    const last = result.at(-1);
    if (!tag && last && !last.tag) last.text += part.text;
    else result.push({ text: part.text, ...(tag ? { tag } : {}) });
  }
  return result;
}
