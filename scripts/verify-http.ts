import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {fromHtml} from 'hast-util-from-html';
import {visit} from 'unist-util-visit';
import {readFile} from 'node:fs/promises';
import {siteConfig} from '../src/site.config';
import {hasBiro,biroURL} from '../src/fonts';
// HTTP client only. No browser, CDP, preview window or third-party request.
const port=14321,base=siteConfig.base,origin=`http://127.0.0.1:${port}`;
const server=spawn('bun',['run','preview','--host','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
try{
  let ready=false;
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw new Error('Preview server exited: '+log);
    try{if((await fetch(origin+base)).ok){ready=true;break;}}catch{}
    await delay(100);
  }
  assert.ok(ready,'HTTP server did not start');
  const home=await (await fetch(origin+base)).text();
  const paths=[base,base+'articles',base+'updates',base+'link',base+'about',base+'journey',base+'03-tools/obsidian-plugin',base+'01-courses/MITOS/',base+'01-courses/MITOS/xv6-lab0',base+'rss.xml',base+'sitemap.xml'];
  for(const match of home.matchAll(/(?:src|data-search-index|data-graph-index)="([^"<>]+)"/g))if(match[1].startsWith(base))paths.push(match[1]);
  if(hasBiro())paths.push(biroURL(base));
  for(const path of paths){const response=await fetch(origin+path);assert.equal(response.status,200,`${path} returned ${response.status}`);assert.ok((await response.arrayBuffer()).byteLength>0);}
  const iconResponse=await fetch(origin+base+'favicon.png');assert.equal(iconResponse.status,200);
  assert.match(iconResponse.headers.get('content-type')||'',/image\/png/);
  assert.deepEqual(Buffer.from(await iconResponse.arrayBuffer()),await readFile('public/favicon.png'));
  const article=await(await fetch(origin+base+'03-tools/obsidian-plugin')).text(),images:any[]=[];
  visit(fromHtml(article),'element',(node:any)=>{if(node.tagName==='img')images.push(node.properties);});
  assert.equal(images.length,2);
  for(const image of images){
    assert.equal(new URL(image.src).hostname,'virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com');
    assert.equal(image.srcSet,undefined);assert.equal(image.sizes,undefined);
    assert.equal(image.loading,'lazy');assert.equal(image.decoding,'async');
    // Remote image availability belongs to the browser, not the build/HTTP check.
  }
  const fontURLs=new Set<string>();
  for(const [,path] of home.matchAll(/href="([^"<>]+\.css)"/g)){
    assert.ok(path.startsWith(base));const css=await(await fetch(origin+path)).text();
    for(const [,value] of css.matchAll(/url\(["']?([^\s)"']+-ui[^\s)"']+\.woff2)/g))fontURLs.add(new URL(value,origin+path).href);
  }
  assert.equal(fontURLs.size,3,'UI font files must be emitted, not inlined or omitted');
  for(const address of fontURLs){assert.ok(new URL(address).pathname.startsWith(base));const response=await fetch(address);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/font\/woff2/);assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString(),'wOF2');}
  assert.equal((await fetch(origin+base+'missing-http-fixture')).status,404);
  console.log(`HTTP checks passed: ${paths.length} resources/deep links including supplied Biro, original favicon, ${images.length} direct OSS image URLs, ${fontURLs.size} generated UI fonts, and 404, base=${base}`);
}finally{server.kill('SIGTERM');await Promise.race([once(server,'exit'),delay(3000)]);if(server.exitCode===null)server.kill('SIGKILL');}
