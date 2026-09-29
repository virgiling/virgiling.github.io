// Server/build initial layout. Dragging lazily reuses this force profile.
import { createGraphSimulation } from "../graph/force-simulator";
import type { GraphNode, GraphEdge, GraphLayout } from "./graph";
type LayoutInput = {
  nodes: Pick<GraphNode, "id" | "current">[];
  edges: Pick<GraphEdge, "from" | "to">[];
};

export function localGraphLayout(
  model: LayoutInput,
): GraphLayout & { scale: number } {
  const width = 300,
    height = 250,
    center = { x: width / 2, y: height / 2 };
  const nodes = model.nodes.map((node) => ({
    id: node.id,
    ...(node.current ? { fx: 0, fy: 0 } : {}),
  }));
  const simulation = createGraphSimulation(
    { nodes, edges: model.edges },
    { local: true },
  );
  simulation.tick(180);
  const settled = simulation.nodes();
  // Fit symmetrically about the current note, not the neighbors' bounding box.
  const extentX = Math.max(1, ...settled.map((node) => Math.abs(node.x!)));
  const extentY = Math.max(1, ...settled.map((node) => Math.abs(node.y!)));
  // Keep sparse spokes compact and leave padding for nodes and labels.
  const scale = Math.min(
    1.15,
    (center.x - 36) / extentX,
    (center.y - 36) / extentY,
  );
  const positions = new Map(
    settled.map((node) => [
      node.id,
      {
        x: Number((center.x + node.x! * scale).toFixed(2)),
        y: Number((center.y + node.y! * scale).toFixed(2)),
      },
    ]),
  );
  return { width, height, positions, scale };
}
