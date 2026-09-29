import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountLocalForce} from '../src/runtime/local-graph-force.js';
const fixture=()=>({nodes:[{id:'a',current:true,x:150,y:125},{id:'b',x:195,y:125},{id:'c',x:150,y:175}],edges:[{from:'a',to:'b'},{from:'b',to:'c'}]});
test('real shared D3 engine follows dragged nodes and relaxes neighbours through the Motion boundary only',()=>{
  const model=fixture(),before=JSON.stringify(model);let tick,settle,latest,starts=0,stopped=false;
  const engine=mountLocalForce(model,{width:300,height:250,scale:1,doc:{},onUpdate:nodes=>latest=nodes.map(n=>({...n})),loop:(step,finish)=>{tick=step;settle=finish;return {start(){starts++;},destroy(){stopped=true;}};}});
  engine.move('b',235,110);assert.equal(latest.find(n=>n.id==='b').x,235);for(let i=0;i<20;i++)tick();assert.notEqual(latest.find(n=>n.id==='c').x,150);
  assert.equal(latest.find(n=>n.id==='a').x,150);engine.release('b');settle();assert.equal(latest.find(n=>n.id==='b').fx,null);
  engine.move('a',120,95);engine.release('a');settle();assert.equal(latest.find(n=>n.id==='a').x,150,'current node returns to the original center on release');assert.equal(latest.find(n=>n.id==='a').y,125);
  assert.ok(latest.every(n=>Number.isFinite(n.x)&&n.x>=12&&n.x<=288&&n.y>=12&&n.y<=226));assert.equal(JSON.stringify(model),before);assert.ok(starts>=4);
  engine.destroy();assert.ok(stopped);
});
test('center release returns progressively without moving the target; redrag interrupts return',()=>{
  let tick,latest;const engine=mountLocalForce(fixture(),{width:300,height:250,doc:{},onUpdate:nodes=>latest=nodes.map(n=>({...n})),loop:step=>{tick=step;return {start(){},destroy(){}};}});
  const current=()=>latest.find(n=>n.current),distance=()=>Math.hypot(current().x-150,current().y-125);
  engine.move('a',240,195);for(let i=0;i<12;i++)tick();assert.deepEqual([current().x,current().y],[240,195],'pointer still owns a held node');
  engine.release('a');assert.deepEqual([current().x,current().y],[240,195],'release must not teleport');
  const start=distance();tick();assert.ok(distance()>0&&distance()<start,'first Motion tick begins a gradual return');
  for(let i=0;i<8;i++)tick();engine.move('a',65,45);for(let i=0;i<5;i++)tick();assert.deepEqual([current().x,current().y],[65,45],'new drag interrupts the old return');
  engine.release('a');let ticks=0;while(tick()&&++ticks<200){}assert.ok(ticks<180);assert.deepEqual([current().x,current().y,current().fx,current().fy],[150,125,150,125]);
  engine.move('a',220,180);engine.release('a');tick();const before=latest;engine.destroy();assert.equal(tick(),false);assert.equal(latest,before,'destroy interrupts an unfinished return');
});
test('late lazy hydration uses the viewport center, not the already dragged position',()=>{
  const model=fixture();Object.assign(model.nodes[0],{x:240,y:195});let settle,latest;
  const engine=mountLocalForce(model,{width:300,height:250,doc:{},onUpdate:nodes=>latest=nodes.map(n=>({...n})),loop:(_step,finish)=>{settle=finish;return {start(){},destroy(){}};}});
  engine.move('a',240,195);engine.release('a');settle();assert.deepEqual([latest[0].x,latest[0].y],[150,125]);engine.destroy();
});
test('current anchor recentres for singleton and dense scaled neighbourhoods',()=>{
  for(const count of [0,1,20,80]){
    const model={nodes:[{id:'center',current:true,x:150,y:125},...Array.from({length:count},(_,i)=>({id:String(i),x:150+70*Math.cos(i),y:125+70*Math.sin(i)}))],edges:Array.from({length:count},(_,i)=>({from:'center',to:String(i)}))};
    let tick,latest;const engine=mountLocalForce(model,{width:300,height:250,scale:.4,doc:{},onUpdate:nodes=>latest=nodes.map(n=>({...n})),loop:step=>{tick=step;return {start(){},destroy(){}};}});
    engine.move('center',15,20);engine.release('center');for(let i=0;i<180;i++)tick();assert.deepEqual([latest[0].x,latest[0].y],[150,125]);assert.ok(latest.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));engine.destroy();
  }
});
test('reduced-motion settle and disposal are bounded; no late updates',()=>{
  let updates=0,latest,settle;const engine=mountLocalForce(fixture(),{width:300,height:250,doc:{},onUpdate:nodes=>{updates++;latest=nodes.map(n=>({...n}));},loop:(_step,finish)=>{settle=finish;return {start:finish,destroy(){}};}});
  engine.move('b',250,190);assert.equal(updates,2);engine.release('b');assert.equal(updates,3);
  engine.move('a',250,190);assert.deepEqual([latest[0].x,latest[0].y],[250,190]);engine.release('a');assert.deepEqual([latest[0].x,latest[0].y],[150,125]);
  const before=updates;engine.destroy();engine.move('a',90,90);engine.release('a');settle();assert.equal(updates,before);
});
