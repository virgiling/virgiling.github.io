import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fromHtml} from 'hast-util-from-html';
import {visit} from 'unist-util-visit';
import {optimizeArticleImages,imageDisplayWidth} from '../src/images/article';
import {allowedImageURL,imageSizes} from '../src/images/policy';
import {probeImage} from '../src/images/metadata';
const source='https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/test.png';
const elements=(html:string,tag:string)=>{const out:any[]=[];visit(fromHtml(html,{fragment:true}),'element',(n:any)=>{if(n.tagName===tag)out.push(n);});return out;};

test('regular/figure/HTML images gain real transform requests, responsive dimensions and native zoom links without cropping',async()=>{
  const requests:any[]=[];
  const html=await optimizeArticleImages(`<p><img src="${source}" alt="截图"></p><figure><img src="${source}" alt="代码|400x300"><figcaption>说明</figcaption></figure><p><a href="https://example.org">原作者链接<img src="${source}" alt="链接图"></a> <a href="https://github.com/sponsors/test">♡</a></p>`,{
    prepare:async src=>({src,width:2940,height:1846,format:'png'}),
    optimize:async options=>{requests.push(options);return {src:'/preview/_astro/image.webp',srcSet:{attribute:options.widths.map((w:number)=>`/preview/_astro/${w}.webp ${w}w`).join(', ')}};},
  });
  assert.deepEqual(requests[0].widths,[360,905,1810]);assert.equal(requests[0].fit,'inside');assert.equal(requests[0].format,'webp');
  assert.deepEqual(requests[1].widths,[360,400,800]);assert.equal(requests[1].height,251);
  const imgs=elements(html,'img');assert.equal(imgs[1].properties.alt,'代码');assert.equal(imgs[0].properties.height,568);assert.equal(imgs[0].properties.decoding,'async');
  assert.ok(imgs[0].properties.srcSet.includes('1810w'));assert.equal(imgs[0].properties.dataZoomSrc,source);assert.equal(imgs[0].properties.dataZoomWidth,'2940');
  const links=elements(html,'a');assert.equal(links.filter(a=>'dataImageZoom' in a.properties).length,2);assert.ok(links.some(a=>a.properties.href==='https://example.org'));assert.ok(html.includes('♡'));assert.ok(html.includes('<figcaption>说明</figcaption>'));assert.equal(elements(html,'a').filter(a=>a.children.some((n:any)=>n.tagName==='a')).length,0);
});

test('small/authored images never upscale; missing metadata retains original and clean accessible alt',async()=>{
  const p={alt:'a|400x100'};assert.equal(imageDisplayWidth(p,{width:100,height:50,format:'png'}),100);assert.equal(p.alt,'a');
  const warnings:string[]=[];
  const html=await optimizeArticleImages(`<p><img src="${source}" alt="代码|400"></p>`,{prepare:async()=>{throw new Error('offline');},optimize:async()=>{throw new Error('not reached');},warn:s=>warnings.push(s)});
  const img=elements(html,'img')[0];assert.equal(img.properties.src,source);assert.equal(img.properties.alt,'代码');assert.equal(img.properties.width,400);assert.equal(img.properties.srcSet,undefined);assert.equal(warnings.length,1);assert.equal(elements(html,'a')[0].properties.href,source);
});

test('remote probing is allowlisted, bounded, abortable and stops after sufficient metadata',async()=>{
  for(const url of ['http://s2.loli.net/a.png','https://localhost/a.png','https://s2.loli.net.evil.org/a.png','https://user:pass@s2.loli.net/a.png','https://s2.loli.net/a.png?token=x','https://s2.loli.net:8443/a.png'])assert.equal(allowedImageURL(url),false,url);
  let called=0,cancelled=false;
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ9kAAAAASUVORK5CYII=','base64');
  const fetcher=(async(_url:any,options:any)=>{called++;assert.equal(options.redirect,'error');assert.ok(options.signal);return new Response(new ReadableStream({start(c){c.enqueue(bytes);},cancel(){cancelled=true;}}));}) as typeof fetch;
  assert.deepEqual(await probeImage(source,fetcher),{width:1,height:1,format:'png'});assert.ok(cancelled);
  await assert.rejects(probeImage('https://localhost/a.png',fetcher));assert.equal(called,1);
  await assert.rejects(probeImage(source,(async()=>new Response('missing',{status:404})) as typeof fetch));
  assert.ok(imageSizes(400).includes('min(400px, calc(100vw - 36px))'));
});
