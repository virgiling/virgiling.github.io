import type { mountGraph } from "./graph-view";
export interface GraphAssets {
  data: unknown;
  mount: typeof mountGraph;
}
let pending: Promise<GraphAssets> | undefined, resource: string | undefined;
export function loadGraphAssets(): Promise<GraphAssets> {
  const url = document.body.dataset.graphIndex;
  if (!url) return Promise.reject(new Error("Missing graph resource URL"));
  if (pending && resource === url) return pending;
  resource = url;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000);
  const data = fetch(url, {
    signal: controller.signal,
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) throw new Error("Graph unavailable");
      return response.json();
    })
    .finally(() => clearTimeout(timer));
  const task: Promise<GraphAssets> = Promise.all([data, import("./graph-view")])
    .then(([data, module]) => ({ data, mount: module.mountGraph }))
    .catch((error) => {
      if (pending === task) pending = undefined;
      throw error;
    });
  pending = task;
  return task;
}
