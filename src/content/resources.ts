import { createHash } from "node:crypto";
import { globalGraphData } from "../ui/graph";
import { exportSearch } from "../search";
import { getSnapshot } from "./snapshot";
import { url } from "../site.config";
import type { Snapshot } from "./types";
const cache = new WeakMap<
  Snapshot,
  Promise<Awaited<ReturnType<typeof build>>>
>();
async function build(snapshot: Snapshot) {
  const search = await exportSearch(
    snapshot.listed.map((n) => ({
      id: n.id,
      url: n.url,
      title: n.title,
      aliases: n.aliases,
      tags: n.tags,
      tagMentions: n.tagMentions,
      summary: n.summary,
      text: n.plainText,
    })),
  );
  const graph = globalGraphData(snapshot.listed);
  const resource = (kind: string, data: unknown) => {
    const body = JSON.stringify(data),
      file =
        kind +
        "-" +
        createHash("sha256").update(body).digest("hex").slice(0, 16);
    return { file, body, url: url("data/" + file + ".json") };
  };
  return {
    search: resource("search", search),
    graph: resource("graph", graph),
  };
}
export async function getResources() {
  const snapshot = await getSnapshot();
  if (!cache.has(snapshot))
    cache.set(
      snapshot,
      build(snapshot).catch((error) => {
        cache.delete(snapshot);
        throw error;
      }),
    );
  return cache.get(snapshot)!;
}
