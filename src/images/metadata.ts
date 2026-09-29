import {imageSize} from 'image-size';
import pLimit from 'p-limit';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {allowedImageURL} from './policy';
export interface Dimensions {width:number;height:number;format:'png'|'jpeg'|'webp'|'avif'}
export function dimensions(bytes:Uint8Array):Dimensions {
  const m=imageSize(bytes),format=m.type==='jpg'?'jpeg':m.type;
  if(!['png','jpeg','webp','avif'].includes(format||''))throw new Error('Unsupported raster format');
  let {width,height}=m;if((m.orientation||0)>=5)[width,height]=[height,width];
  if(!width||!height||width*height>80_000_000)throw new Error('Invalid or oversized image');
  return {width,height,format:format as Dimensions['format']};
}
// Bounded header probing, not a download/resize engine. Astro owns transforms.
export async function probeImage(src:string,fetcher:typeof fetch=fetch):Promise<Dimensions> {
  if(!allowedImageURL(src))throw new Error('Image origin not allowed');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10_000);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try {
    // Reject redirects rather than accidentally following an allowlisted URL to a private host.
    const response=await fetcher(src,{redirect:'error',signal:controller.signal});
    if(!response.ok||!response.body)throw new Error('Image unavailable');
    reader=response.body.getReader();let bytes=Buffer.alloc(0);
    while(bytes.length<1024*1024){
      const {done,value}=await reader.read();if(done)break;
      bytes=Buffer.concat([bytes,Buffer.from(value)]);if(bytes.length>1024*1024)break;
      try{return dimensions(bytes);}catch{/* Some formats need more header bytes. */}
    }
    throw new Error('Image metadata unavailable within header limit');
  }finally {clearTimeout(timer);await reader?.cancel().catch(()=>{});controller.abort();}
}
const pending=new Map<string,Promise<Dimensions>>(),limit=pLimit(4),ttl=24*60*60*1000;
export function remoteDimensions(src:string):Promise<Dimensions> {
  if(!allowedImageURL(src))return Promise.reject(new Error('Image origin not allowed'));
  const hit=pending.get(src);if(hit)return hit;
  const task=limit(async()=>{
    const key=createHash('sha256').update(src).digest('hex'),dir=resolve('.astro/notes-image-metadata'),path=resolve(dir,key+'.json');
    try {const stored=JSON.parse(await readFile(path,'utf8'));if(Date.now()-stored.time<ttl&&stored.width>0&&stored.height>0&&['png','jpeg','webp','avif'].includes(stored.format))return {width:stored.width,height:stored.height,format:stored.format} as Dimensions;}catch{/* Cold/expired/corrupt cache. */}
    const result=await probeImage(src);
    await mkdir(dir,{recursive:true});const temporary=path+`.${process.pid}.tmp`;
    await writeFile(temporary,JSON.stringify({...result,time:Date.now()}));await rename(temporary,path);
    return result;
  });
  pending.set(src,task);
  // No rejected-promise poisoning; a subsequent request may retry the image.
  void task.finally(()=>pending.delete(src)).catch(()=>{});
  return task;
}
