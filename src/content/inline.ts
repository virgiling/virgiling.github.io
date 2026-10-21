import { posix } from "node:path";
import { url } from "../site.config";
import { inlineTagParts, sliceTagParts } from "../inline-tags";
import { inlineTagNodes, sourceText } from "../markdown/inline-tags";
import { mediaTypes } from "./assets";
import { selectEmbedded, scopeEmbedIds } from "./embeds";
import { wikiLabel } from "./parse";
import type { Resolver } from "./resolve";
import type { Note, Asset } from "./types";

const t = (value: string) => ({ type: "text", value });
// An authored label is public; missing targets never supply titles or content.
const unavailable = (label: string) => ({
  type: "link",
  url: url("404"),
  children: [t(label)],
});

export interface TextContext {
  note: Note;
  owner: Note;
  record: boolean;
  chain: string[];
  serial: () => number;
  footnotes: any[];
  resolver: Resolver;
  asset: (from: Note, target: string) => Promise<Asset | undefined>;
  walk: (
    node: any,
    owner: Note,
    chain: string[],
    record: boolean,
  ) => Promise<any>;
}

export async function rewriteText(node: any, context: TextContext) {
  const {
    note,
    owner,
    record,
    chain,
    serial,
    footnotes,
    resolver,
    asset: resolveAsset,
  } = context;
  const parts = inlineTagParts(node.value, sourceText(node, owner.body));
  const tagged = (start: number, end: number) =>
    inlineTagNodes(sliceTagParts(parts, start, end), !note.unlisted);
  const children: any[] = [];
  let cursor = 0;
  const pattern =
    /(!?)\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|==([^=\n]+)==|\^\[([^\]\n]+)\]/g;
  for (const match of node.value.matchAll(pattern)) {
    children.push(...tagged(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[4]) {
      children.push({
        type: "emphasis",
        data: { hName: "mark" },
        children: tagged(match.index + 2, match.index + match[0].length - 2),
      });
      continue;
    }
    if (match[5]) {
      const id = `inline-${serial()}`;
      footnotes.push({
        type: "footnoteDefinition",
        identifier: id,
        children: [
          {
            type: "paragraph",
            children: tagged(
              match.index + 2,
              match.index + match[0].length - 1,
            ),
          },
        ],
      });
      children.push({ type: "footnoteReference", identifier: id });
      continue;
    }
    const embedded = !!match[1],
      target = match[2],
      label = wikiLabel(target, match[3]);
    const media = await resolveAsset(owner, target);
    if (media) {
      if (embedded) {
        const size = /^(\d{1,4})(?:x(\d{1,4}))?$/.exec(match[3] || "");
        const ext = posix.extname(media.output);
        if ([".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm"].includes(ext))
          children.push({
            type: "text",
            value: "",
            data: {
              hName: [".mp4", ".webm"].includes(ext) ? "video" : "audio",
              hProperties: {
                src: media.url,
                controls: true,
                preload: "none",
              },
            },
          });
        else if (ext === ".pdf")
          children.push({
            type: "link",
            url:
              media.url +
              (/^.*#page=\d+$/.test(target) ? "#" + target.split("#")[1] : ""),
            children: [t(label + "（PDF）")],
          });
        else
          children.push({
            type: "image",
            url: media.url,
            alt: size ? "" : label,
            data: {
              hProperties: size
                ? {
                    width: Number(size[1]),
                    ...(size[2] ? { height: Number(size[2]) } : {}),
                  }
                : {},
            },
          });
      } else
        children.push({
          type: "link",
          url: media.url,
          children: [t(label)],
        });
      continue;
    }
    const result = resolver.resolve(owner, target, {
      embed: embedded,
    });
    if (!result) {
      // Image references disappear, but their separate caption stays authored prose.
      if (
        embedded &&
        /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|heic)(?:#.*)?$/i.test(target)
      )
        continue;
      const sizeAlias =
        embedded &&
        mediaTypes.has(posix.extname(target.split("#")[0]).toLowerCase()) &&
        /^\d{1,4}(?:x\d{1,4})?$/.test(match[3] || "");
      children.push(unavailable(sizeAlias ? wikiLabel(target) : label));
      continue;
    }
    if (record && !note.links.includes(result.note.id))
      note.links.push(result.note.id);
    if (!embedded) {
      children.push({
        type: "link",
        url: result.href,
        data: {
          hProperties: result.note.unlisted
            ? {}
            : { dataPreview: result.note.id },
        },
        children: [t(label)],
      });
      continue;
    }
    if (chain.includes(result.note.id) || chain.length >= 5) {
      children.push(t("嵌入已停止：循环引用或超出深度限制。"));
      resolver.warn(owner, "embed-cycle", "Transclusion cycle/depth guard");
      continue;
    }
    const copy = structuredClone(result.note.tree);
    const selected = selectEmbedded(copy, result.anchor, result.note.blocks);
    const scope = `embed-${serial()}-`;
    scopeEmbedIds(selected, scope);
    const content = await Promise.all(
      selected.map((n) =>
        context.walk(n, result.note, [...chain, result.note.id], false),
      ),
    );
    children.push({
      type: "blockquote",
      data: { hProperties: { className: ["note-embed"] } },
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: result.href,
              children: [t(result.note.title)],
            },
          ],
        },
        ...content,
      ],
    });
  }
  children.push(...tagged(cursor, node.value.length));
  return { type: "fragment", children };
}
