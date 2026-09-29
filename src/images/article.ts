import {fromHtml} from 'hast-util-from-html';
import {toHtml} from 'hast-util-to-html';
import {visitParents} from 'unist-util-visit-parents';
import {imageSizes,readingWidth} from './policy';
import type {Dimensions} from './metadata';
export interface PreparedImage extends Dimensions {src:unknown}
export interface ImageTools {
  prepare:(src:string)=>Promise<PreparedImage|undefined>;
  optimize:(options:any)=>Promise<{src:string;srcSet:{attribute:string}}>;
  warn?:(src:string)=>void;
}
export function imageDisplayWidth(properties:any,original:Dimensions) {
  // OFM also allows ![alt|400] and ![alt|400x300] on regular Markdown images.
  // Dimensions constrain the box; preserve the source aspect ratio, never crop.
  const suffix=/\|(\d{1,4})(?:x(\d{1,4}))?$/.exec(String(properties.alt||''));
  if(suffix){properties.alt=String(properties.alt).slice(0,suffix.index);properties.width=Number(suffix[1]);if(suffix[2])properties.height=Number(suffix[2]);}
  const positive=(n:unknown)=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):Infinity;
  return Math.max(1,Math.floor(Math.min(readingWidth,original.width,positive(properties.width),positive(properties.height)*original.width/original.height)));
}
export async function optimizeArticleImages(html:string,tools:ImageTools):Promise<string> {
  if(!/<img\b/i.test(html))return html;
  const tree=fromHtml(html,{fragment:true}),jobs:Promise<void>[]=[];
  visitParents(tree,'element',(node:any,ancestors:any[])=>{
    if(node.tagName!=='img')return;
    const p=node.properties,original=String(p.src||'');if(!original)return;
    const linked=ancestors.some(n=>n.tagName==='a');
    jobs.push((async()=>{
      p.loading='lazy';p.decoding='async';
      // Clean the OFM size suffix even when optimization cannot run (offline/unknown host).
      const requested={...p};imageDisplayWidth(p,{width:readingWidth,height:readingWidth,format:'png'});
      if(Number(p.width)>0)p.width=Math.min(Number(p.width),readingWidth);
      try {
        const prepared=await tools.prepare(original);
        if(prepared){
          const width=imageDisplayWidth(requested,prepared),height=Math.max(1,Math.round(width*prepared.height/prepared.width));
          const widths=[...new Set([Math.min(360,width),width,Math.min(width*2,prepared.width)])].sort((a,b)=>a-b);
          const result=await tools.optimize({src:prepared.src,width,height,widths,format:'webp',fit:'inside',quality:85});
          Object.assign(p,{src:result.src,srcSet:result.srcSet.attribute,sizes:imageSizes(width),width,height,alt:requested.alt,dataImageOptimized:'',dataZoomWidth:prepared.width,dataZoomHeight:prepared.height});
        }
      }catch {tools.warn?.(original);}
      // Do not hijack an author-authored image link (or generate nested anchors).
      if(!linked){
        const parent=ancestors.at(-1),index=parent.children.indexOf(node);
        p.dataZoomSrc=original;
        parent.children[index]={type:'element',tagName:'a',properties:{href:original,className:['image-zoom-link'],dataImageZoom:'',ariaLabel:p.alt?`放大图片：${p.alt}`:'放大图片'},children:[node]};
      }
    })());
  });
  await Promise.all(jobs);return toHtml(tree);
}
