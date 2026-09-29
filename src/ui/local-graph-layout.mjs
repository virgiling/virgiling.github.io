// Server/build initial layout. Dragging lazily reuses this force profile.
import { createGraphSimulation } from "../graph/force-simulator.mjs";

export function localGraphLayout(model) {
  const width = 300,
    height = 250,
    center = { x: width / 2, y: height / 2 };
  const nodes = model.nodes.map((n) => ({
    id: n.id,
    ...(n.current ? { fx: 0, fy: 0 } : {}),
  }));
  const simulation = createGraphSimulation(
    { nodes, edges: model.edges },
    { local: true },
  );
  simulation.tick(180);
  const settled = simulation.nodes();
  // Fit symmetrically about the current note, not the neighbours' bounding-box
  // midpoint. This keeps the current note exactly centred even in sparse graphs.
  const extentX = Math.max(1, ...settled.map((n) => Math.abs(n.x))),
    extentY = Math.max(1, ...settled.map((n) => Math.abs(n.y)));
  // Do not enlarge sparse layouts back to long spokes after strengthening
  // attraction. Keep padding for larger nodes and the always-visible label.
  const scale = Math.min(
    1.15,
    (center.x - 36) / extentX,
    (center.y - 36) / extentY,
  );
  const positions = new Map(
    settled.map((n) => [
      n.id,
      {
        x: Number((center.x + n.x * scale).toFixed(2)),
        y: Number((center.y + n.y * scale).toFixed(2)),
      },
    ]),
  );
  return { width, height, positions, scale };
}
