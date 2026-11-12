import { readFile } from "node:fs/promises";
import { getSnapshot } from "../../content/snapshot";
import { contentFile } from "../../content/read";
import type { Asset } from "../../content/types";
export async function getStaticPaths() {
  const assets = new Map(
    (await getSnapshot()).assets.map((asset) => [asset.output, asset]),
  );
  return [...assets.values()].map((asset) => ({
    params: { file: asset.output },
    props: { asset },
  }));
}
export async function GET({ props }: { props: { asset: Asset } }) {
  const asset = props.asset;
  if (asset.kind === "excalidraw")
    return new Response(asset.content, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  return new Response(
    new Uint8Array(await readFile(await contentFile("content", asset.source))),
  );
}
