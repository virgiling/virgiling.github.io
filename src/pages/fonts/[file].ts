import {readFile} from 'node:fs/promises';
import type {APIRoute} from 'astro';
import {hasBiro,biroPath} from '../../fonts';
// The file is supplied locally, never downloaded or copied into tracked public/.
export const getStaticPaths=()=>hasBiro()?[{params:{file:'biro-script-plus.woff2'}}]:[];
export const GET:APIRoute=async({params})=>{
  if(params.file!=='biro-script-plus.woff2'||!hasBiro())return new Response(null,{status:404});
  return new Response(new Uint8Array(await readFile(biroPath())),{headers:{'Content-Type':'font/woff2'}});
};
