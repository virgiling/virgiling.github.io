import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nodeDegrees,nodeRadius,labelOpacity,globalLabelOpacity} from '../src/graph/display';
import {createGraphSimulation} from '../src/graph/force-simulator';
import {renderComponent} from './helpers/render-astro';

test('global degree counts unique real neighbors, ignoring reciprocal/duplicate/self links',()=>{
  const model={nodes:['a','b','c','tag','isolated'].map(id=>({id})),edges:[{from:'a',to:'b'},{from:'b',to:'a'},{from:'a',to:'b'},{from:'a',to:'a'},{from:'a',to:'c'},{from:'a',to:'tag'}]};
  assert.deepEqual([...nodeDegrees(model)],[['a',3],['b',1],['c',1],['tag',1],['isolated',0]]);
  const before=JSON.stringify(model),sim=createGraphSimulation(model);const nodes=new Map<string,{radius:number}>(sim.nodes().map((n:{id:string;radius:number})=>[n.id,n]));
  assert.ok(nodes.get('a')!.radius>nodes.get('b')!.radius);assert.ok(nodes.get('b')!.radius>nodes.get('isolated')!.radius);assert.equal(JSON.stringify(model),before);sim.stop();
});
test('global degree radii stay visible at overview scale and distinguish ordinary nodes from hubs before capping',()=>{
  const degrees=[0,1,2,4,8,16,22,32,36,100,100000],radii=degrees.map(nodeRadius);
  assert.equal(radii[0],.85*6);assert.equal(nodeRadius(1),.85*10);assert.equal(nodeRadius(4),.85*14);assert.equal(nodeRadius(16),.85*22);assert.equal(radii.at(-1),.85*30);
  assert.ok(radii.every((r,i)=>r>=.85*6&&r<=.85*30&&(!i||r>=radii[i-1])));
  assert.ok(radii.slice(1,9).every((r,i)=>r>radii[i]),'Low, medium and high degrees must not collapse to the same radius');
  for(const zoom of [.25,.35]){
    assert.ok(nodeRadius(1)*zoom>=2,'Degree-one nodes retain a visible overview radius after the size reduction');
    assert.ok((nodeRadius(22)-nodeRadius(1))*zoom>3,'The overview must preserve a meaningful hub-size gap');
  }
});
test('global text fade shifts its zoom onset to .75 while local labels and node sizes stay unchanged',async()=>{
  assert.equal(globalLabelOpacity(.75),0);assert.ok(globalLabelOpacity(1)>0);assert.ok(Math.abs(globalLabelOpacity(1.9*.75)-1)<1e-12);assert.equal(globalLabelOpacity(5),1);
  assert.equal(labelOpacity(.35),0);assert.equal(labelOpacity(1),0);assert.ok(labelOpacity(1.25)>0);assert.equal(labelOpacity(1.9),1);assert.equal(labelOpacity(6),1);
  const note={slug:'a',title:'A',url:'/a',tags:[],links:['b','c']};
  const html=await renderComponent('LocalGraph',{note,neighbors:['b','c'].map(slug=>({slug,title:slug,url:`/${slug}`,tags:[],links:[]}))});
  assert.equal((html.match(/r="5.5"/g)||[]).length,2);assert.match(html,/current-node[^>]+r="7"/);
});
