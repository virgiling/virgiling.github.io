// Zoom-label ramp adapted from starlight-site-graph 0.5.0
// GraphSimulator.getCurrentLabelOpacity (Fevol, MIT; public/licenses/).
// Both renderers use scale 1: hide ordinary labels at rest, reveal on zoom.
export const labelOpacity = (zoom: number) =>
  zoom >= 1.9 ? 1 : Math.max(0, (zoom - 1) / 0.9);
export const nodeRadius = (degree: number) =>
  Math.min(12, 5 + 1.5 * Math.sqrt(Math.max(0, degree)));
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
