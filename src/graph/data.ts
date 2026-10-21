// Public graph model and runtime validation for the global graph view.
export interface Point {
  x: number;
  y: number;
}
export interface ViewTransform extends Point {
  k: number;
}
export interface GraphNode extends Point {
  id: string;
  type: "page" | "tag";
  label: string;
  url: string;
  path?: string;
  radius?: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  type: "page-link" | "tag-parent" | "tag-membership";
}
export interface GraphData {
  version: 1;
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";
export function safeGraphURL(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const path = decodeURIComponent(value);
    return (
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !/[\\\\?#:\u0000-\u0020\u007f]/.test(path) &&
      !path.split("/").some((p) => p === "." || p === "..")
    );
  } catch {
    return false;
  }
}
export function validateGraph(data: unknown): GraphData {
  if (
    !record(data) ||
    data.version !== 1 ||
    typeof data.width !== "number" ||
    !Number.isFinite(data.width) ||
    data.width <= 0 ||
    typeof data.height !== "number" ||
    !Number.isFinite(data.height) ||
    data.height <= 0 ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges)
  )
    throw new Error("Invalid graph data");
  const ids = new Set<string>();
  for (const n of data.nodes as unknown[]) {
    if (
      !record(n) ||
      typeof n.id !== "string" ||
      ids.has(n.id) ||
      !(n.type === "page" || n.type === "tag") ||
      typeof n.label !== "string" ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      !safeGraphURL(n.url)
    )
      throw new Error("Invalid graph node");
    ids.add(n.id);
  }
  for (const e of data.edges as unknown[])
    if (
      !record(e) ||
      typeof e.from !== "string" ||
      typeof e.to !== "string" ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      !(
        e.type === "page-link" ||
        e.type === "tag-parent" ||
        e.type === "tag-membership"
      )
    )
      throw new Error("Invalid graph edge");
  return data as unknown as GraphData;
}
