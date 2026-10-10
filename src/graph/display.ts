// Zoom-label ramp adapted from starlight-site-graph 0.5.0
// GraphSimulator.getCurrentLabelOpacity (Fevol, MIT; public/licenses/).
// Local labels retain their original ramp; the global preset scales its onset.
import { globalGraphStyle } from "./global-style";
export const labelOpacity = (zoom: number) =>
  zoom >= 1.9 ? 1 : Math.max(0, (zoom - 1) / 0.9);
export const globalLabelOpacity = (zoom: number) =>
  labelOpacity(zoom / globalGraphStyle.textFade);
export const nodeRadius = (degree: number) =>
  globalGraphStyle.nodeSize *
  Math.min(
    globalGraphStyle.node.maxRadius,
    globalGraphStyle.node.minRadius +
      globalGraphStyle.node.degreeScale * Math.sqrt(Math.max(0, degree)),
  );
export interface GraphTopology {
  nodes: { id: string }[];
  edges: { from: string; to: string }[];
}
// Count distinct neighbors, not reciprocal, duplicate or self links.
export function nodeDegrees(model: GraphTopology): Map<string, number> {
  const adjacent = new Map(
    model.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const { from, to } of model.edges) {
    if (from === to || !adjacent.has(from) || !adjacent.has(to)) continue;
    adjacent.get(from)!.add(to);
    adjacent.get(to)!.add(from);
  }
  return new Map([...adjacent].map(([id, neighbors]) => [id, neighbors.size]));
}
