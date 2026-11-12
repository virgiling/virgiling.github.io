import type { Blockquote } from "mdast";
import type { Root } from "hast";
import { visit } from "unist-util-visit";
import type { Asset, DrawingAsset } from "../content/types";

export function drawingWikiAlias(alias = "") {
  const sized = /^(?:(.*)\|)?(\d{1,4}(?:x\d{1,4})?)$/.exec(alias);
  return { label: sized ? sized[1] : alias, size: sized?.[2] || "" };
}

export function drawingEmbed(
  asset: DrawingAsset,
  label: string,
  size = "",
): Blockquote {
  const dimensions = /^(\d{1,4})(?:x(\d{1,4}))?$/.exec(size);
  return {
    type: "blockquote",
    data: {
      hName: "figure",
      hProperties: {
        className: ["excalidraw-embed"],
        dataExcalidraw: asset.url,
        dataLabel: label,
        ...(dimensions
          ? {
              dataWidth: dimensions[1],
              ...(dimensions[2] ? { dataHeight: dimensions[2] } : {}),
            }
          : {}),
      },
    },
    children: [
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            url: asset.url,
            children: [{ type: "text", value: `${label}（Excalidraw 数据）` }],
          },
        ],
      },
    ],
  };
}

// Authored HTML must not turn an arbitrary URL into a client-side scene fetch.
export function rehypeExcalidraw(assets: Map<string, Asset>) {
  const allowed = new Set(
    [...assets.values()]
      .filter((asset) => asset.kind === "excalidraw")
      .map((asset) => asset.url),
  );
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (
        node.properties.dataExcalidraw !== undefined &&
        (node.tagName !== "figure" ||
          !allowed.has(String(node.properties.dataExcalidraw)))
      ) {
        delete node.properties.dataExcalidraw;
        delete node.properties.dataLabel;
        delete node.properties.dataWidth;
        delete node.properties.dataHeight;
      }
    });
  };
}
