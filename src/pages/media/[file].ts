import { readFile } from "node:fs/promises";
import { getSnapshot } from "../../content/snapshot";
import { contentFile } from "../../content/read";
export async function getStaticPaths() {
  return (await getSnapshot()).assets.map((asset) => ({
    params: { file: asset.output },
    props: { source: asset.source },
  }));
}
export async function GET({ props }) {
  return new Response(
    new Uint8Array(await readFile(await contentFile("content", props.source))),
  );
}
