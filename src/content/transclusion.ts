import { url } from "../site.config";
import { htmlLiteralContexts, rawHTMLTags } from "../markdown/inline-tags";
import { rewriteText } from "./inline";
import type { Resolver } from "./resolve";
import type { Note, Asset } from "./types";

const t = (value: string) => ({ type: "text", value });

export interface TransclusionOptions {
  note: Note;
  resolver: Resolver;
  asset: (from: Note, target: string) => Promise<Asset | undefined>;
}

export function createTransclusion({
  note,
  resolver,
  asset: resolveAsset,
}: TransclusionOptions) {
  let serial = 0,
    budget = 0;
  const footnotes: any[] = [];
  const walk = async (
    node: any,
    owner: Note,
    chain: string[],
    record: boolean,
    literalContext = false,
  ): Promise<any> => {
    if (literalContext) return node;
    if (node.type === "html")
      return { ...node, value: rawHTMLTags(node.value, !note.unlisted).html };
    if (++budget > 40000)
      throw new Error(`Transclusion budget exceeded: ${note.source}`);
    if (node.type === "code") {
      if (node.lang === "poetry") return { ...node, lang: "text" };
      if (
        ["base", "query", "dataview", "dataviewjs", "mermaid"].includes(
          node.lang,
        )
      ) {
        resolver.warn(
          owner,
          "unsupported-fence",
          `${node.lang} is not evaluated in this milestone`,
        );
        return {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [t(`${node.lang} 视图暂不支持。`)],
            },
          ],
        };
      }
    }
    if (node.type === "linkReference") return node;
    if (node.type === "text")
      return rewriteText(node, {
        note,
        owner,
        record,
        chain,
        serial: () => ++serial,
        footnotes,
        resolver,
        asset: resolveAsset,
        walk,
      });
    if (["link", "image", "definition"].includes(node.type)) {
      if (
        /^https?:\/\//i.test(node.url) ||
        (/^mailto:/i.test(node.url) && node.type !== "image")
      )
        return node;
      // Embedded nodes already carry absolute, base-aware generated URLs.
      if (node.url?.startsWith(url("media/"))) return node;
      const asset = await resolveAsset(owner, node.url);
      if (asset) {
        node.url = asset.url;
      } else if (node.type === "image") {
        resolver.warn(
          owner,
          "unavailable-asset",
          "Image is not in the allowed asset set",
        );
        return { type: "fragment", children: [] };
      } else {
        const result = resolver.resolve(owner, node.url);
        if (!result) return { ...node, url: url("404") };
        node.url = result.href;
        if (record && !note.links.includes(result.note.id))
          note.links.push(result.note.id);
        if (node.type === "link" && !result.note.unlisted)
          node.data = {
            ...node.data,
            hProperties: {
              ...node.data?.hProperties,
              dataPreview: result.note.id,
            },
          };
      }
    }
    // Authored links already have a destination; never nest tag links in them.
    if (node.type === "link") return node;
    if (node.children) {
      const contexts = htmlLiteralContexts(node.children);
      node.children = (
        await Promise.all(
          node.children.map((n: any, i: number) =>
            walk(n, owner, chain, record, contexts[i]),
          ),
        )
      ).flatMap((n) => (n.type === "fragment" ? n.children : [n]));
      if (node.type === "paragraph" && node.children.length === 0)
        return { type: "fragment", children: [] };
      // Transclusions are block nodes, never invalid blockquotes inside a paragraph.
      if (
        node.type === "paragraph" &&
        node.children.some((n: any) => n.type === "blockquote")
      ) {
        const parts: any[] = [];
        let inline: any[] = [];
        for (const child of node.children) {
          if (child.type === "blockquote") {
            if (inline.length)
              parts.push({ type: "paragraph", children: inline });
            inline = [];
            parts.push(child);
          } else inline.push(child);
        }
        if (inline.length) parts.push({ type: "paragraph", children: inline });
        return { type: "fragment", children: parts };
      }
    }
    return node;
  };
  return { walk, footnotes };
}
