import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {fromHtml} from 'hast-util-from-html';
import {visit} from 'unist-util-visit';
import {articleImages} from '../src/images/article';
const source='https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/202412170045329.png';
const elements=(html:string,tag:string)=>{const out:any[]=[];visit(fromHtml(html,{fragment:true}),'element',(n:any)=>{if(n.tagName===tag)out.push(n);});return out;};

test('OSS images retain their original URLs and render without build-time network or WebP variants',()=>{
  const fetcher=mock.method(globalThis,'fetch',()=>{throw new Error('Build must not fetch images');});
  try{
    const html=articleImages(`<p><img src="${source}" alt="截图"></p><figure><img src="${source}" alt="代码|400x300"><figcaption>说明</figcaption></figure>`);
    const imgs=elements(html,'img');
    assert.equal(fetcher.mock.callCount(),0);
    for(const {properties:p} of imgs){
      assert.equal(p.src,source);assert.equal(p.srcSet,undefined);assert.equal(p.sizes,undefined);
      assert.equal(p.dataImageOptimized,undefined);assert.equal(p.dataZoomSrc,undefined);
      assert.equal(p.loading,'lazy');assert.equal(p.decoding,'async');
    }
    assert.equal(imgs[0].properties.width,undefined,'do not guess intrinsic dimensions');
    assert.equal(imgs[1].properties.alt,'代码');assert.equal(imgs[1].properties.width,400);assert.equal(imgs[1].properties.height,300);
    assert.equal(imgs[1].properties.style,'--image-width:400px;--image-height:300px');
    assert.equal(imgs[1].properties.dataImageSized,'');
    assert.ok(html.includes('<figcaption>说明</figcaption>'));
    const links=elements(html,'a');assert.equal(links.length,2);
    assert.ok(links.every(link=>link.properties.href===source&&'dataImageZoom' in link.properties));
  }finally{fetcher.mock.restore();}
});

test('local assets, GIFs, signed OSS URLs and authored links remain unchanged',()=>{
  const sources=['/preview/media/allowed.png','https://s2.loli.net/animation.gif',source+'?sign=example&expires=123'];
  for(const src of sources){
    const html=articleImages(`<a href="https://example.org"><img src="${src.replaceAll('&','&amp;')}" alt="链接图" width="240"></a>`);
    assert.equal(elements(html,'img')[0].properties.src,src);
    const links=elements(html,'a');assert.equal(links.length,1);assert.equal(links[0].properties.href,'https://example.org');
    assert.equal(links[0].properties.dataImageZoom,undefined);
  }
});

test('OFM and HTML size requests become display bounds without guessing image aspect ratios',()=>{
  const cases=[
    ['alt="宽度|400"','宽度','--image-width:400px'],
    ['alt="高度" height="200"','高度','--image-height:200px'],
    ['alt="范围" width="1200" height="600"','范围','--image-width:1200px;--image-height:600px'],
    ['alt="无效|0x0" width="-3"','无效',undefined],
    ['alt="bad" width="Infinity" height="-1"','bad',undefined],
  ];
  for(const [attrs,alt,style] of cases){
    const p=elements(articleImages(`<img src="${source}" ${attrs}>`),'img')[0].properties;
    assert.equal(p.alt,alt);assert.equal(p.style,style);
    if(!style){assert.equal(p.width,undefined);assert.equal(p.height,undefined);}
  }
  assert.equal(articleImages('<p>No images</p>'),'<p>No images</p>');
  assert.equal(elements(articleImages('<img alt="missing source">'),'a').length,0);
});
