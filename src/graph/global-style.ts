// One global-only profile for build-time layout and lazy Canvas interaction.
// Local one-hop graphs deliberately keep their own compact force settings.
export const globalGraphStyle = {
  force: {
    // Site control units, not a claim of Obsidian engine equivalence:
    // center -> D3 X/Y strength; repel -> D3 charge * -100.
    center: 0.42,
    repel: 7.5,
    link: 0.82,
    distance: 100,
    collisionPadding: 3,
    alphaDecay: 0.03,
    ticks: 240,
  },
  textFade: 0.75,
  nodeSize: 0.85,
  linkThickness: 0.5, // Screen pixels, independent of viewport zoom.
  // Radius grows through degree 36, keeping ordinary nodes and hubs distinct.
  node: { minRadius: 6, degreeScale: 4, maxRadius: 30 },
} as const;

export type GraphRelation = "page-link" | "tag-membership" | "tag-parent";
