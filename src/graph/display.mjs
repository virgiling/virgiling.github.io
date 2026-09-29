// Zoom-label ramp adapted from starlight-site-graph 0.5.0
// GraphSimulator.getCurrentLabelOpacity (Fevol, MIT; public/licenses/).
// Both renderers use scale 1: hide ordinary labels at rest, reveal on zoom.
export const labelOpacity=zoom=>zoom>=1.9?1:Math.max(0,(zoom-1)/.9);
export const nodeRadius=degree=>Math.min(12,5+1.5*Math.sqrt(Math.max(0,degree)));
// Degree means distinct adjacent nodes across real edge types. Reciprocal links
// do not inflate importance; neither self-links nor duplicate edges count twice.
export function nodeDegrees(model){
  const adjacent=new Map(model.nodes.map(n=>[n.id,new Set()]));
  for(const {from,to} of model.edges){if(from===to||!adjacent.has(from)||!adjacent.has(to))continue;adjacent.get(from).add(to);adjacent.get(to).add(from);}
  return new Map([...adjacent].map(([id,neighbors])=>[id,neighbors.size]));
}
