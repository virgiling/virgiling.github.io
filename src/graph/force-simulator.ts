/*! Force core adapted from starlight-site-graph 0.5.0 GraphSimulator.update/enableDrag.
 * Copyright (c) 2024 Fevol, MIT. See public/licenses/starlight-site-graph.txt.
 * Retains d3-force link/charge/centering/collision and drag reheat semantics.
 * Adaptations: cloned public model, deterministic seeds, Motion-owned ticking,
 * no Starlight/Pixi/GSAP/prefetch, no implicit D3 animation timer.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
} from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import { nodeDegrees, nodeRadius } from "./display";
import { globalGraphStyle, type GraphRelation } from "./global-style";
export interface ForceNode extends SimulationNodeDatum {
  id: string;
  current?: boolean;
}
export interface ForceModel<N extends ForceNode = ForceNode> {
  nodes: N[];
  edges: { from: string; to: string; type?: GraphRelation }[];
}
export interface ForceOptions {
  x?: number;
  y?: number;
  local?: boolean;
  scale?: number;
}
export type SimulatedNode<N extends ForceNode> = N &
  SimulationNodeDatum & {
    radius: number;
    degree?: number;
  };
const hash = (id: string) => {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
};
export function createGraphSimulation<N extends ForceNode>(
  model: ForceModel<N>,
  { x = 0, y = 0, local = false, scale = 1 }: ForceOptions = {},
) {
  // Local and global views share the plugin-derived engine, not a second tween.
  const degrees = local ? null : nodeDegrees(model);
  const nodes: SimulatedNode<N>[] = model.nodes.map((n) =>
    local
      ? { ...n, radius: n.current ? 7 : 5.5 }
      : {
          ...n,
          degree: degrees!.get(n.id)!,
          radius: nodeRadius(degrees!.get(n.id)!),
        },
  );
  if (!local)
    nodes.sort(
      (a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id, "en"),
    );
  const links = model.edges.map((e) => ({
    ...e,
    source: e.from,
    target: e.to,
    type: e.type || "page-link",
  }));
  if (local)
    return forceSimulation(nodes)
      .stop()
      .force("charge", forceManyBody().strength(-80 * scale * scale))
      .force(
        "link",
        forceLink<SimulatedNode<N>, (typeof links)[number]>(links)
          .id((n) => n.id)
          .distance(52 * scale)
          .strength(0.75),
      )
      .force("collision", forceCollide(15 * scale).iterations(2))
      .force("forceX", forceX(x).strength(0.1))
      .force("forceY", forceY(y).strength(0.1));
  const { force: settings } = globalGraphStyle;
  const simulation = forceSimulation(nodes)
    .stop()
    .force(
      "link",
      forceLink<SimulatedNode<N>, (typeof links)[number]>(links)
        .id((n) => n.id)
        .distance(settings.distance)
        .strength(settings.link),
    )
    .force("charge", forceManyBody().strength(-100 * settings.repel))
    .force("forceX", forceX(x).strength(settings.center))
    .force("forceY", forceY(y).strength(settings.center))
    .force(
      "collision",
      forceCollide<SimulatedNode<N>>().radius(
        (n) => n.radius + settings.collisionPadding,
      ),
    )
    .alphaDecay(settings.alphaDecay);
  return simulation;
}
export function globalForceLayout(model: ForceModel) {
  const simulation = createGraphSimulation(model);
  simulation.tick(globalGraphStyle.force.ticks);
  const nodes = simulation.nodes();
  const width = Math.max(240, ...nodes.map((n) => Math.abs(n.x!) * 2 + 100));
  const height = Math.max(200, ...nodes.map((n) => Math.abs(n.y!) * 2 + 100));
  const positions = new Map(
    nodes.map((n) => [
      n.id,
      { x: +(n.x! + width / 2).toFixed(3), y: +(n.y! + height / 2).toFixed(3) },
    ]),
  );
  simulation.stop();
  return { width, height, positions };
}
