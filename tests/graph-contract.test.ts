import {test} from 'node:test';
import assert from 'node:assert/strict';
import {globalGraphData} from '../src/ui/graph';
import {validateGraph,safeGraphURL} from '../src/runtime/graph-view';

test('graph producer and browser validator agree on real Astro route shapes',()=>{
  const data=globalGraphData([
    {slug:'index.md',title:'Home',url:'/',tags:[],links:['folder/index.md']},
    {slug:'folder/index.md',title:'Folder',url:'/folder/',tags:['主题/系统'],links:['folder/中文.md']},
    {slug:'folder/中文.md',title:'中文',url:'/folder/中文',tags:['主题/系统'],links:[]},
  ]);
  assert.equal(validateGraph(data),data);
  assert.doesNotThrow(()=>validateGraph({...data,nodes:data.nodes.map(n=>({...n,url:'/preview'+n.url}))}));
});
test('graph URLs reject external origins, protocols, traversal and encoded escapes',()=>{
  for(const value of ['javascript:alert(1)','https://evil.test/a','//evil.test/a','/%2fevil.test/a','/a/../private','/a/%2e%2e/private','/a\\b','/%5cevil','/a?next=evil','/a#hash','/a%0ab','/%','a.html'])assert.equal(safeGraphURL(value),false,value);
  for(const value of ['/','/about','/01-courses/MITOS/','/preview/关于','/preview/%E5%85%B3%E4%BA%8E','/old.html'])assert.equal(safeGraphURL(value),true,value);
});
