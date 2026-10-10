import {test} from 'node:test';
import assert from 'node:assert/strict';
import {globalForceLayout,createGraphSimulation} from '../src/graph/force-simulator';
import {globalGraphData} from '../src/ui/graph';
import {renderComponent} from './helpers/render-astro';
import {globalGraphStyle,type GraphRelation} from '../src/graph/global-style';
import type {ForceLink,ForceManyBody,ForceX,SimulationLinkDatum,SimulationNodeDatum} from 'd3-force';

test('adapted force core gives deterministic finite compact positions, not tag levels or article rows',()=>{
  const pages=Array.from({length:32},(_,i)=>({slug:`n${i}`,title:`Note ${i}`,url:`/n${i}`,tags:[`主题/分组${i%4}`],links:[`n${(i+1)%32}`]}));
  const a=globalGraphData(pages),b=globalGraphData(pages);assert.deepEqual(a,b);assert.equal(a.layout,'force');
  const articles=a.nodes.filter(n=>n.type==='page');assert.equal(new Set(articles.map(n=>n.y)).size,32);assert.ok(a.height/a.width<2,'not a tall fixed-column article grid');
  assert.ok(a.nodes.some(n=>n.type==='tag'),'Tags must remain enabled during preset tuning');
  assert.ok(a.edges.some(e=>e.type==='tag-parent')&&a.edges.some(e=>e.type==='tag-membership'),'Both tag ancestry and membership participate in the graph');
  for(const n of a.nodes){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.ok(n.x>=49&&n.x<=a.width-49);assert.ok(n.y>=49&&n.y<=a.height-49);}
});
test('fixed-distance links form connected communities without collapsing nodes; source data is immutable',()=>{
  const nodes=Array.from({length:20},(_,i)=>({id:`n${i}`,type:'page'}));
  const edges:{from:string;to:string}[]=[];
  for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)if(Math.floor(i/5)===Math.floor(j/5))edges.push({from:nodes[i].id,to:nodes[j].id});
  const model={nodes,edges},before=JSON.stringify(model);
  const layout=globalForceLayout(model),p=layout.positions,dist=(a:string,b:string)=>Math.hypot(p.get(a)!.x-p.get(b)!.x,p.get(a)!.y-p.get(b)!.y);
  const within:number[]=[],between:number[]=[];
  for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)(Math.floor(i/5)===Math.floor(j/5)?within:between).push(dist(nodes[i].id,nodes[j].id));
  const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  // A target link distance does not require isolated pairs to be nearest neighbors.
  // Compare actual multi-note communities instead of imposing that false invariant.
  assert.ok(median(within)<median(between));assert.ok(Math.min(...within,...between)>20);assert.equal(JSON.stringify(model),before);
  const sim=createGraphSimulation(model);sim.tick(20);const [node]=sim.nodes();node.fx=200;node.fy=100;sim.alpha(.3).tick(20);assert.equal(node.x,200);assert.equal(node.y,100);node.fx=node.fy=null;sim.alpha(.3).tick(30);assert.notEqual(node.x,200);sim.stop();
});
test('global preset applies uniform strong links, unrestricted repulsion and direct center with bounded cooling',()=>{
  const model={nodes:['a','b','c','tag','parent','isolated'].map(id=>({id})),edges:[
    {from:'a',to:'b',type:'page-link' as const},{from:'a',to:'c',type:'page-link' as const},
    {from:'a',to:'tag',type:'tag-membership' as const},{from:'tag',to:'parent',type:'tag-parent' as const},
  ]};
  const before=JSON.stringify(model),sim=createGraphSimulation(model);
  type Node=SimulationNodeDatum & {id:string};
  type Link=SimulationLinkDatum<Node> & {type:GraphRelation;from:string;to:string};
  const link=sim.force<ForceLink<Node,Link>>('link')!,links=link.links();
  assert.equal(links.length,model.edges.length,'Styling must never invent relations');
  assert.deepEqual(links.map((e,i)=>link.distance()(e,i,links)),[100,100,100,100]);
  assert.deepEqual(links.map((e,i)=>link.strength()(e,i,links)),[.82,.82,.82,.82],'Do not silently weaken the requested link force by degree or relation');
  const charge=sim.force<ForceManyBody<Node>>('charge')!;
  assert.equal(charge.distanceMax(),Infinity);assert.equal(charge.strength()(sim.nodes()[0],0,sim.nodes()),-750);
  for(const name of ['forceX','forceY']){const center=sim.force<ForceX<Node>>(name)!;assert.equal(center.strength()(sim.nodes()[0],0,sim.nodes()),.42);}
  sim.tick(globalGraphStyle.force.ticks);assert.ok(sim.alpha()<sim.alphaMin());
  assert.ok(sim.nodes().every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));assert.equal(JSON.stringify(model),before);sim.stop();
  const local=createGraphSimulation(model,{local:true});
  const localLink=local.force<ForceLink<Node,Link>>('link')!;
  assert.ok(localLink.links().every((e,i,all)=>localLink.distance()(e,i,all)===52&&localLink.strength()(e,i,all)===.75));
  assert.ok(local.nodes().every(n=>n.radius===5.5),'Local one-hop geometry stays unchanged');local.stop();
});
test('global existing-files graph preserves tags but excludes missing targets, attachments and non-discoverable pages',()=>{
  const pages=[
    {slug:'a.md',title:'A',url:'/a',tags:['topic/shared'],links:['b.md','missing.md','photo.png','hidden.md','private.md']},
    {slug:'b.md',title:'B',url:'/b',tags:['topic/shared'],links:[]},
    {slug:'alone.md',title:'Alone',url:'/alone',tags:[],links:[]},
    {slug:'hidden.md',title:'Hidden',url:'/hidden',tags:[],links:[],unlisted:true},
    {slug:'private.md',title:'Private',url:'/private',tags:[],links:[],publish:false},
  ];
  const graph=globalGraphData(pages);
  assert.deepEqual(graph.nodes.map(n=>n.id),['page:a.md','page:b.md','page:alone.md','tag:topic','tag:topic/shared']);
  assert.deepEqual(graph.edges.filter(edge=>edge.type==='page-link'),[{from:'page:a.md',to:'page:b.md',type:'page-link'}]);
  assert.equal(graph.edges.filter(edge=>edge.type==='tag-parent').length,1);
  assert.equal(graph.edges.filter(edge=>edge.type==='tag-membership').length,2);
});
test('global modal keeps page and tag legends plus required controls/state, without extra lists',async()=>{
  const html=await renderComponent('GraphDialog',{note:{slug:'n0'}});assert.match(html,/graph-legend/);assert.match(html,/retry-graph/);
  assert.match(html,/legend-tag/);assert.match(html,/legend-page/);
  assert.doesNotMatch(html,/graph-hint|graph-fallback|页面与标签列表|<details|拖动平移|标签按父子层级/);
});
