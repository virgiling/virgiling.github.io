import {dev} from 'astro';
import {createConnection} from 'node:net';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {siteConfig} from '../src/site.config';
import {validateGraph} from '../src/runtime/graph-view.js';
import {hasBiro,biroPath,biroURL,biroStyles} from '../src/fonts';
import {verifyDevGraph} from './dev-graph-contract';

// Programmatic server on a separate port: no browser, no lock-file replacement,
// no content edits. Watch events below are synthetic; the submodule stays clean.
process.env.ASTRO_TELEMETRY_DISABLED='1';
const port=14323,base=siteConfig.base,origin=`http://127.0.0.1:${port}`;
const busy=await new Promise<boolean>(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
assert.ok(!busy,'Dev verification port is occupied; no existing server will be stopped.');
let vite:any,compilations=0;
const log=console.log;console.log=(...args:unknown[])=>{if(String(args[0]).startsWith('[content]'))compilations++;log(...args);};
const server=await dev({server:{host:'127.0.0.1',port,open:false},integrations:[{name:'notes-test-capture',hooks:{'astro:server:setup':({server})=>{vite=server;}}}]});
async function page(path=base){const response=await fetch(origin+path);assert.equal(response.status,200,path);return response.text();}
try{
  const home=await page();const first=compilations;assert.equal(first,1);
  await Promise.all([page(),page(base+'about'),page(base+'articles')]);assert.equal(compilations,first,'warm/concurrent page requests must reuse content');
  const graph=/data-graph-index="([^"]+)"/.exec(home)![1];
  const graphResponse=await fetch(origin+graph);assert.equal(graphResponse.status,200);validateGraph(await graphResponse.json());assert.equal(compilations,first,'graph fetch must not recompile content');
  console.log(await verifyDevGraph(origin,base));
  const fontCSS=await page(base+'src/styles/site.css?direct'),uiFonts=new Set<string>();
  for(const [,value] of fontCSS.matchAll(/url\(["']?([^\s)"']+-ui[^\s)"']*\.woff2)/g))uiFonts.add(value);
  assert.equal(uiFonts.size,3,'Dev CSS must reference all generated UI subsets');
  const fontResponses:{path:string;status:number;type:string|null;bytes:number}[]=[];
  for(const path of uiFonts){
    // Vite can serve its /src asset URLs at the origin root even with a base.
    // Follow the real CSS, not a guessed prefix; production paths remain strict.
    const address=new URL(path,origin+base+'src/styles/site.css');assert.equal(address.origin,origin);
    const response=await fetch(address),bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/font\/woff2/);assert.equal(bytes.subarray(0,4).toString(),'wOF2');
    fontResponses.push({path,status:response.status,type:response.headers.get('content-type'),bytes:bytes.length});
  }
  await mkdir('.astro/reports',{recursive:true});
  await writeFile(`.astro/reports/dev-fonts-${base==='/'?'root':'base'}.json`,JSON.stringify({base,responses:fontResponses},null,2));
  if(hasBiro()){
    assert.ok(home.includes(biroStyles(base)));assert.ok(home.includes('data-biro'));
    const response=await fetch(origin+biroURL(base));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'font/woff2');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(biroPath()));
  }
  const environment=vite.environments.prerender||vite.environments.ssr;
  assert.ok(environment?.runner,'Astro rendering environment must be available');
  const module=await environment.runner.import(resolve('src/content/snapshot.ts'));
  const snapshot=await module.getSnapshot();assert.equal(compilations,first,'test must use the same snapshot as HTTP rendering');
  const note=snapshot.notes.find((n:{source:string;title:string})=>n.source==='index.md'),canary='DEV_ROUTE_CACHE_CANARY';note.title=canary;
  assert.ok((await page()).includes(canary),'seed the cached route props in memory, without editing source files');
  server.watcher.emit('all','change',resolve('content/private/ignored.md'));await delay(150);
  assert.ok((await page()).includes(canary));assert.equal(compilations,first,'ignored paths must not invalidate caches');
  server.watcher.emit('all','change',resolve('content/index.md'));await delay(150);
  const refreshed=await page();assert.ok(!refreshed.includes(canary),'Astro route props must also be invalidated');assert.equal(compilations,first+1);
  await page();assert.equal(compilations,first+1,'new revision should compile only once');
  console.log(JSON.stringify({base,status:'passed',checks:['warm/concurrent cache reuse','actual graph validation','HTTP-served graph dependency import/mount/draw/reset/cleanup','generated UI font CSS/URLs/WOFF2 responses','Biro declaration/binary','ignored-path no-op','content + Astro route cache invalidation'],contentCompilations:compilations}));
}finally{console.log=log;await server.stop();}
