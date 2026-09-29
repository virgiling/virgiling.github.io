// Loaded only on node-drag intent; no global graph fetch or extra neighbours.
import {
  createGraphSimulation,
  type ForceModel,
  type ForceNode,
} from "../graph/force-simulator";
import { motionLoop, type MotionDocument } from "./motion";
export interface LocalForceNode extends ForceNode {
  x: number;
  y: number;
}
export interface LocalForceController {
  move(id: string, x: number, y: number): void;
  release(id: string): void;
  destroy(): void;
}
interface LocalForceOptions {
  width: number;
  height: number;
  scale?: number;
  onUpdate: (nodes: LocalForceNode[]) => void;
  doc?: MotionDocument;
  loop?: (
    ...args: Parameters<typeof motionLoop>
  ) => Pick<ReturnType<typeof motionLoop>, "start" | "destroy">;
}
export function mountLocalForce(
  model: ForceModel<LocalForceNode>,
  {
    width,
    height,
    scale = 1,
    onUpdate,
    doc = document,
    loop = motionLoop,
  }: LocalForceOptions,
): LocalForceController {
  // Lazy hydration can happen AFTER dragging. Never take its displaced point as home.
  const home = { x: width / 2, y: height / 2 },
    simulation = createGraphSimulation(model, { local: true, scale, ...home });
  const nodes = simulation.nodes(),
    byId = new Map(nodes.map((n) => [n.id, n]));
  let remaining = 0,
    disposed = false,
    returning = false;
  const current = nodes.find((n) => n.current);
  if (current) {
    current.fx = current.x;
    current.fy = current.y;
  }
  // One isolated D3 particle returns the anchor without neighbouring forces moving
  // its resting target. Same stopped engine/profile and Motion clock, no new tween.
  const spring = current
    ? createGraphSimulation<LocalForceNode>(
        { nodes: [], edges: [] },
        { local: true, ...home },
      ).alphaDecay(0)
    : undefined;
  function constrain() {
    for (const n of nodes) {
      n.x = Math.max(12, Math.min(width - 12, n.x));
      n.y = Math.max(12, Math.min(height - 24, n.y));
      if (n.fx != null) {
        n.fx = n.x;
        n.fy = n.y;
      }
    }
  }
  function update() {
    constrain();
    if (!disposed) onUpdate(nodes);
  }
  function advance() {
    if (returning && spring && current) {
      spring.tick();
      const [anchor] = spring.nodes();
      if (
        Math.hypot(
          anchor.x - home.x,
          anchor.y - home.y,
          anchor.vx!,
          anchor.vy!,
        ) < 0.02
      ) {
        current.fx = home.x;
        current.fy = home.y;
        returning = false;
        spring.nodes([]);
      } else {
        current.fx = anchor.x;
        current.fy = anchor.y;
      }
    }
    simulation.tick();
    constrain();
  }
  const clock = loop(
    () => {
      if (disposed) return false;
      advance();
      update();
      return --remaining > 0 && simulation.alpha() >= simulation.alphaMin();
    },
    () => {
      if (disposed) return;
      for (let i = 0; i < 180; i++) advance();
      update();
    },
    doc,
  );
  function reheat() {
    if (disposed) return;
    remaining = 180;
    simulation.alpha(0.3);
    clock.start();
  }
  return {
    move(id: string, x: number, y: number) {
      if (disposed) return;
      const n = byId.get(id);
      if (!n) return;
      n.x = n.fx = x;
      n.y = n.fy = y;
      n.vx = n.vy = 0;
      if (n.current) {
        returning = false;
        spring!.nodes([]);
      }
      update();
      reheat();
    },
    release(id: string) {
      const n = byId.get(id);
      if (!n || disposed) return;
      n.fx = n.fy = null;
      if (n.current) {
        spring!
          .nodes([{ id: n.id, x: n.x, y: n.y, radius: n.radius }])
          .alpha(1);
        returning = true;
      }
      reheat();
    },
    destroy() {
      disposed = true;
      clock.destroy();
      simulation.stop().force("link", null).nodes([]);
      spring?.stop().nodes([]);
    },
  };
}
