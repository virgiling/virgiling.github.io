import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {cpus} from 'node:os';
import {importSearch} from '../src/search';
import {validateGraph} from '../src/runtime/graph-view.js';
import {localGraphLayout} from '../src/ui/local-graph-layout.mjs';

// CPU costs of the actual pure functions, not browser event-to-paint latency.
// Read only published build data. No browser, DOM emulation or network service.
const round=(n:number)=>Math.round(n*100)/100;
const timed=<T>(f:()=>T)=>{const start=performance.now(),value=f();return {ms:round(performance.now()-start),value};};
const distribution=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,p50:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
const files=await readdir('dist/data');
const searchText=await readFile('dist/data/'+files.find(f=>f.startsWith('search-')),'utf8');
const parsed=timed(()=>JSON.parse(searchText));
const imported=timed(()=>importSearch(parsed.value));
const tag=parsed.value.records.find((r:{tags:string[]})=>r.tags.length)?.tags[0];
const queries=['操作系统','xv6','Obsidian','COW',...(tag?['#'+tag]:[])];
const search=queries.map(query=>{
  const first=timed(()=>imported.value(query)),samples:number[]=[];
  for(let i=0;i<30;i++)samples.push(timed(()=>imported.value(query)).ms);
  return {query,resultCount:first.value.length,firstMs:first.ms,warmMs:distribution(samples)};
});
const graphText=await readFile('dist/data/'+files.find(f=>f.startsWith('graph-')),'utf8');
const graph=timed(()=>validateGraph(JSON.parse(graphText)));
const layouts=[2,20,80].map(neighbours=>{
  const model={nodes:Array.from({length:neighbours+1},(_,i)=>({id:String(i),current:i===0})),edges:Array.from({length:neighbours},(_,i)=>({from:'0',to:String(i+1)}))};
  const first=timed(()=>localGraphLayout(model)),samples:number[]=[];
  for(let i=0;i<30;i++)samples.push(timed(()=>localGraphLayout(model)).ms);
  return {nodes:model.nodes.length,edges:model.edges.length,ticks:180,firstMs:first.ms,warmMs:distribution(samples)};
});
const result={at:new Date().toISOString(),node:process.version,cpu:cpus()[0]?.model,scope:'Node CPU only. First operation in this process, then 30 warm iterations per case; module loading/file reads excluded. No Worker startup/transfer, browser DOM/layout/paint, Canvas draw, input-to-paint, font decode, WAN or mobile-device timing. Samples describe this run, not statistical assurance.',search:{records:parsed.value.records.length,jsonParseMs:parsed.ms,indexImportMs:imported.ms,queries:search},globalGraph:{nodes:graph.value.nodes.length,edges:graph.value.edges.length,jsonParseAndValidateMs:graph.ms},localLayout:{scope:'Synthetic star graphs, server/build-only d3-force; not client interaction latency or a plugin benchmark.',cases:layouts}};
await mkdir('.astro/reports',{recursive:true});
await writeFile('.astro/reports/interaction-cpu.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
