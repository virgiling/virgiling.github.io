import {test} from 'node:test';
import assert from 'node:assert/strict';
import {globalForceLayout,createGraphSimulation} from '../src/graph/force-simulator.mjs';
import {globalGraphData,GraphDialog} from '../src/ui/graph.mjs';

test('adapted force core gives deterministic finite compact positions, not tag levels or article rows',()=>{
  const pages=Array.from({length:32},(_,i)=>({slug:`n${i}`,title:`Note ${i}`,url:`/n${i}`,tags:[`主题/分组${i%4}`],links:[`n${(i+1)%32}`]}));
  const a=globalGraphData(pages),b=globalGraphData(pages);assert.deepEqual(a,b);assert.equal(a.layout,'force');
  const articles=a.nodes.filter(n=>n.type==='page');assert.equal(new Set(articles.map(n=>n.y)).size,32);assert.ok(a.height/a.width<2,'not a tall fixed-column article grid');
  assert.ok(a.edges.some(e=>e.type==='tag-parent'),'hierarchy remains real relationship data, not prescribed geometry');
  for(const n of a.nodes){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.ok(n.x>=49&&n.x<=a.width-49);assert.ok(n.y>=49&&n.y<=a.height-49);}
});
test('link attraction clusters connected pairs while charge and collision separate nodes; source data is immutable',()=>{
  const model={nodes:['a','b','c','d'].map(id=>({id,type:'page'})),edges:[{from:'a',to:'b'},{from:'c',to:'d'}]},before=JSON.stringify(model);
  const layout=globalForceLayout(model),p=layout.positions,dist=(a:string,b:string)=>Math.hypot(p.get(a).x-p.get(b).x,p.get(a).y-p.get(b).y);
  assert.ok(dist('a','b')<dist('a','c'));assert.ok(dist('a','b')>20);assert.equal(JSON.stringify(model),before);
  const sim=createGraphSimulation(model);sim.tick(20);const [node]=sim.nodes();node.fx=200;node.fy=100;sim.alpha(.3).tick(20);assert.equal(node.x,200);assert.equal(node.y,100);node.fx=node.fy=null;sim.alpha(.3).tick(30);assert.notEqual(node.x,200);sim.stop();
});
test('global modal retains legend and required controls/state only, with no lists or extra guidance',()=>{
  const html=GraphDialog({slug:'n0'});assert.match(html,/graph-legend/);assert.match(html,/retry-graph/);
  assert.doesNotMatch(html,/graph-hint|graph-fallback|页面与标签列表|<details|拖动平移|标签按父子层级/);
});
