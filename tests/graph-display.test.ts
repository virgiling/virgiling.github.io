import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodeDegrees,nodeRadius,labelOpacity} from '../src/graph/display.mjs';
import {createGraphSimulation} from '../src/graph/force-simulator.mjs';
import {LocalGraph} from '../src/ui/graph.mjs';

test('global degree counts unique real neighbors, ignoring reciprocal/duplicate/self links',()=>{
  const model={nodes:['a','b','c','tag','isolated'].map(id=>({id})),edges:[{from:'a',to:'b'},{from:'b',to:'a'},{from:'a',to:'b'},{from:'a',to:'a'},{from:'a',to:'c'},{from:'a',to:'tag'}]};
  assert.deepEqual([...nodeDegrees(model)],[['a',3],['b',1],['c',1],['tag',1],['isolated',0]]);
  const before=JSON.stringify(model),sim=createGraphSimulation(model);const nodes=new Map<string,{radius:number}>(sim.nodes().map((n:{id:string;radius:number})=>[n.id,n]));
  assert.ok(nodes.get('a')!.radius>nodes.get('b')!.radius);assert.ok(nodes.get('b')!.radius>nodes.get('isolated')!.radius);assert.equal(JSON.stringify(model),before);sim.stop();
});
test('global radii are monotonically bounded to 5–12, including dense hubs',()=>{
  const radii=[0,1,2,4,10,100,100000].map(nodeRadius);assert.equal(radii[0],5);assert.equal(radii.at(-1),12);
  assert.ok(radii.every((r,i)=>r>=5&&r<=12&&(!i||r>=radii[i-1])));
});
test('both graph renderers share a bounded zoom-driven label ramp; local nodes remain fixed-size',()=>{
  assert.equal(labelOpacity(.35),0);assert.equal(labelOpacity(1),0);assert.ok(labelOpacity(1.25)>0);assert.equal(labelOpacity(1.9),1);assert.equal(labelOpacity(6),1);
  const note={slug:'a',title:'A',url:'/a',tags:[],links:['b','c']};
  const html=LocalGraph(note,['b','c'].map(slug=>({slug,title:slug,url:`/${slug}`,tags:[],links:[]})));
  assert.equal((html.match(/r="5.5"/g)||[]).length,2);assert.match(html,/current-node[^>]+r="7"/);
});
