import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {localGraphModel,LocalGraph,globalGraphData} from '../src/ui/graph.mjs';
import {localGraphLayout} from '../src/ui/local-graph-layout.mjs';
const note=(slug:string,links:string[]=[],tags:string[]=[])=>({slug,url:`/${slug}`,title:slug,publish:true,links,tags});
const current=note('current',['outgoing','private','unlisted'],['topic/deep','own']);
const candidates=[note('outgoing',['two-hop'],['foreign/far']),note('incoming',['current'],['backlink-tag']),note('two-hop'),note('same-tag-only',[],['own']),{...note('private',['current'],['secret']),publish:false},{...note('unlisted',['current'],['hidden']),unlisted:true}];
test('local graph contains precisely one-hop pages and current explicit tags, not neighbour tags or ancestors',()=>{
  const model=localGraphModel(current,candidates);
  assert.deepEqual(new Set(model.nodes.map(n=>n.id)),new Set(['page:current','page:outgoing','page:incoming','tag:topic/deep','tag:own']));
  const ids=new Set(model.nodes.map(n=>n.id));
  assert.ok(model.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
  for(const node of model.nodes.filter(n=>!n.current))assert.ok(model.edges.some(e=>(e.from==='page:current'&&e.to===node.id)||(e.to==='page:current'&&e.from===node.id)));
  const global=globalGraphData([current,...candidates]);
  assert.ok(global.nodes.some(n=>n.id==='tag:topic'));assert.ok(global.nodes.some(n=>n.id==='tag:foreign/far'));assert.ok(global.nodes.some(n=>n.id==='page:two-hop'));
  assert.ok(!global.nodes.some(n=>n.id==='page:unlisted'||n.id==='tag:hidden'||n.id==='page:private'));
});
test('bounded-tick local layout centres the current note, is repeatable, finite and fits a compact viewport',()=>{
  for(const neighbors of [[],[note('incoming',['current'])],candidates,Array.from({length:80},(_,i)=>note(`fan-${i}`,['current']))]){
    const model=localGraphModel(current,neighbors),layout=localGraphLayout(model);
    assert.deepEqual(layout.positions.get('page:current'),{x:layout.width/2,y:layout.height/2});
    assert.deepEqual(layout,localGraphLayout(localGraphModel(current,[...neighbors].reverse())));
    assert.equal(layout.width,300);assert.equal(layout.height,250);
    for(const point of layout.positions.values()){assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(point.x>=36&&point.x<=264&&point.y>=36&&point.y<=214);}
  }
  const singleton=localGraphLayout(localGraphModel(note('alone'),[]));assert.deepEqual(singleton.positions.get('page:alone'),{x:150,y:125});
});
test('sparse one-hop layouts keep short spokes rather than scaling them back to the viewport edge',()=>{
  const model=localGraphModel(note('current'),[note('a',['current']),note('b',['current'])]);
  const layout=localGraphLayout(model),center=layout.positions.get('page:current')!;
  for(const node of model.nodes.filter(n=>!n.current)){const p=layout.positions.get(node.id)!;assert.ok(Math.hypot(p.x-center.x,p.y-center.y)<70);}
});
test('local markup has one global entry, no toolbar/instruction/legend, with centred current node and native links',()=>{
  const html=LocalGraph(current,candidates);
  assert.equal((html.match(/<button\b/g)||[]).length,1);assert.match(html,/id="open-graph"/);
  assert.ok(!/data-local-action|graph-local-controls|local-graph-help|graph-legend|Home 复位/.test(html));
  assert.match(html,/class="page-node current-node" cx="150" cy="125"/);
  assert.match(html,/class="page-node current-node" cx="150" cy="125" r="7"/);
  assert.match(html,/class="page-node"[^>]+r="5\.5"/);assert.match(html,/class="graph-hit"[^>]+r="12"/);
  assert.match(html,/href="\/incoming"/);assert.ok(!html.includes('foreign/far'));assert.ok(!html.includes('two-hop'));
  let currentCount=0;
  const visit=(node:any)=>{const attrs=Object.fromEntries((node.attrs||[]).map((a:any)=>[a.name,a.value]));if(attrs['aria-current']==='page')currentCount++;node.childNodes?.forEach(visit);};visit(parse(html));
  assert.equal(currentCount,1);
});
