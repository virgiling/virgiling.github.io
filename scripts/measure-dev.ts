import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {siteConfig} from '../src/site.config';
import {parse} from 'parse5';
import {hasBiro,biroURL} from '../src/fonts';

// Sequential HTTP samples, not a browser rendering benchmark. A fresh server
// distinguishes process-cold work from repeated requests in the same process.
const port=14322,base=siteConfig.base,origin=`http://127.0.0.1:${port}`;
const listening=()=>new Promise<boolean>(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
if(await listening())throw new Error(`Measurement port ${port} is occupied; no existing service will be stopped.`);
const server=spawn('bun',['run','dev','--ignore-lock','--host','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
const samples:{name:string;path:string;status:number;headersMs:number;ms:number;decodedBytes:number;contentCompilations:number}[]=[];
const round=(ms:number)=>Math.round(ms*10)/10;
const compilations=()=>[...log.matchAll(/\[content\] \d+ pages/g)].length;
async function sample(name:string,path:string){
  const before=compilations(),start=performance.now(),response=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});
  const headersMs=performance.now()-start,body=await response.arrayBuffer(),ms=performance.now()-start;
  // Let subprocess logs drain AFTER recording HTTP timings; never subtract a
  // nominal timer delay from a measurement (older saved samples used that method).
  await delay(30);samples.push({name,path,status:response.status,headersMs:round(headersMs),ms:round(ms),decodedBytes:body.byteLength,contentCompilations:compilations()-before});
  if(response.status!==200)throw new Error(`${path}: ${response.status}`);
  return Buffer.from(body).toString('utf8');
}
try{
  for(let i=0;i<200&&!await listening();i++){if(server.exitCode!==null)throw new Error(log);await delay(100);}
  const home=await sample('home-process-cold',base);
  await sample('home-warm-1',base);await sample('about-after-home',base+'about');await sample('home-warm-2',base);
  const graph=/data-graph-index="([^"]+)"/.exec(home)?.[1];
  if(graph){await sample('graph-first-http',graph);await sample('graph-warm-http',graph);}
  for(let i=3;i<=12;i++)await sample('home-warm-'+i,base);
  for(let i=2;i<=12;i++)if(graph)await sample('graph-warm-http-'+i,graph);
  if(hasBiro()){await sample('biro-first-http',biroURL(base));await sample('biro-warm-http',biroURL(base));}
  const archive=await sample('archive-first-http',base+'articles');await sample('archive-warm-http',base+'articles');
  let moc:string|undefined;
  function findMoc(node:any){
    if(moc)return;const attrs=Object.fromEntries((node.attrs||[]).map((a:{name:string;value:string})=>[a.name,a.value]));
    if('data-directory-moc' in attrs)moc=attrs.href;
    node.childNodes?.forEach(findMoc);
  }
  findMoc(parse(archive));
  if(moc){await sample('moc-first-http',moc);await sample('moc-warm-http',moc);}
  const label=process.env.DEV_MEASURE_LABEL||'current';
  const result={label,methodVersion:2,node:process.version,base,scope:'Local sequential HTTP through body consumption, measured before log-drain delay. Headers timing is fetch response availability. No browser, CSS/layout/font decode, WAN, or cleared OS/Vite disk cache. Warm samples are a small descriptive series, not statistical assurance.',samples,totalContentCompilations:compilations()};
  await mkdir('.astro/reports',{recursive:true});
  await writeFile(`.astro/reports/dev-${label}.json`,JSON.stringify(result,null,2));
  await writeFile(`.astro/reports/dev-${label}.log`,log);
  console.log(JSON.stringify(result,null,2));
}finally{server.kill('SIGTERM');await Promise.race([once(server,'exit'),delay(3000)]);if(server.exitCode===null)server.kill('SIGKILL');}
