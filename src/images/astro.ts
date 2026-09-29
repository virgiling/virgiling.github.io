import {getImage} from 'astro:assets';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {contentFile} from '../content/read';
import type {Asset} from '../content/types';
import {allowedImageURL} from './policy';
import {dimensions,remoteDimensions} from './metadata';
import {optimizeArticleImages} from './article';
const warned=new Set<string>();
export function articleImages(html:string,assets:Asset[]) {
  return optimizeArticleImages(html,{
    optimize:getImage,
    prepare:async(src)=>{
      const asset=assets.find(a=>a.url===src);
      if(asset&&/\.(png|jpe?g|webp|avif)$/i.test(asset.output)){
        const meta=dimensions(await readFile(await contentFile('content',asset.source)));
        // The existing media route emits this exact referenced asset, in dev and static builds.
        return {...meta,src:{src,width:meta.width,height:meta.height,format:meta.format}};
      }
      if(allowedImageURL(src))return {...await remoteDimensions(src),src};
      return undefined;
    },
    warn:(src)=>{
      const key=createHash('sha256').update(src).digest('hex').slice(0,12);
      if(!warned.has(key)){warned.add(key);console.warn(`[images] ${key}: metadata/transform preparation failed; retaining original image`);}
    },
  });
}
