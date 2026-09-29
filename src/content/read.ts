import { readdir, readFile, realpath, open } from 'node:fs/promises';
import { resolve, relative, posix } from 'node:path';
import { parseDocument } from 'yaml';
import { classifyContentPath } from '../content-policy.mjs';
import { url } from '../site.config';
import type { Note } from './types';

export function safePath(path:string) {
  if(path.includes('\\')||path.includes('\0')||path.startsWith('/')||/^[a-z]:/i.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Unsafe content path');
  return path.normalize('NFC');
}
export function routeFor(path:string) {
  safePath(path);
  const route=path.replace(/\.md$/i,'').split('/').map(s=>s.replace(/\s/g,'-').replace(/[?#]/g,'')).join('/');
  return route==='index'?'':route.replace(/\/index$/,'/');
}
export function splitFrontmatter(source:string) {
  const match=source.replace(/^\uFEFF/,'').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if(!match)return null;
  const parsed=parseDocument(match[1],{schema:'core',uniqueKeys:true});
  if(parsed.errors.length)throw new Error('Invalid YAML frontmatter');
  const data=parsed.toJS({maxAliasCount:50});
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Frontmatter must be a mapping');
  return {data,body:source.replace(/^\uFEFF/,'').slice(match[0].length)};
}
// Read only the metadata prefix until publication is established. Never parse a
// private body merely to learn that it should have been excluded.
async function header(path:string) {
  const file=await open(path,'r'); let text='';
  try {
    for await(const line of file.readLines()){
      text+=line+'\n';
      if(text.length>65536)throw new Error('Frontmatter exceeds 64 KiB');
      if(text==='---\n'||text==='\uFEFF---\n')continue;
      if(!text.startsWith('---\n')&&!text.startsWith('\uFEFF---\n'))return null;
      if(line==='---')return splitFrontmatter(text)?.data;
    }
    return null;
  } finally {await file.close();}
}
const list=(value:unknown):string[] => (Array.isArray(value)?value:typeof value==='string'?[value]:[]).filter((v):v is string=>typeof v==='string').map(v=>v.normalize('NFC').trim()).filter(Boolean);
function date(data:Record<string,unknown>,key:string) {
  const value=data[key];if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(value))throw new Error(`Invalid ${key}`);
  const day=value.slice(0,10),ms=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)throw new Error(`Invalid ${key}`);
  return day;
}
export async function readContent(root:string):Promise<{notes:Note[];files:Set<string>}> {
  const base=await realpath(root),notes:Note[]=[],files=new Set<string>();
  async function walk(folder='') {
    for(const entry of (await readdir(resolve(base,folder),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
      const path=folder?`${folder}/${entry.name}`:entry.name;
      // Dotfiles, credential-like filenames and hard ignores never enter parsing.
      if(entry.name.startsWith('.')||/(?:^|[._-])(?:credentials?|secrets?|tokens?|passwords?)(?:[._-]|$)/i.test(entry.name))continue;
      if(classifyContentPath(path)==='ignored')continue;
      if(entry.isSymbolicLink())throw new Error('Symbolic links are not allowed in content');
      if(entry.isDirectory()){await walk(path);continue;}
      if(!entry.isFile())continue;
      safePath(path);files.add(path);
      if(classifyContentPath(path)!=='markdown')continue;
      const absolute=resolve(base,path),data=await header(absolute);
      if(data?.publish!==true)continue;
      for(const key of ['unlisted','comments','stale'])if(data[key]!==undefined&&typeof data[key]!=='boolean')throw new Error(`Invalid ${key} in published note ${path}`);
      const body=splitFrontmatter(await readFile(absolute,'utf8'))!.body;
      const route=routeFor(path),isDirectoryIndex=path.endsWith('/index.md');
      const text=(key:string)=>typeof data[key]==='string'?data[key].trim():'';
      if(data.staleAfter!==undefined&&(!Number.isInteger(data.staleAfter)||data.staleAfter<0))throw new Error('Invalid staleAfter');
      notes.push({
        id:path,slug:path,source:path,route,url:url(route),title:text('title')||posix.basename(path,'.md'),
        aliases:list(data.aliases),tags:[...new Set(list(data.tags).map(t=>t.replace(/^#/,'').replace(/^\/+|\/+$/g,'')))].filter(Boolean),
        publish:true,unlisted:data.unlisted===true,kind:['index.md','about.md'].includes(path)?'landing':isDirectoryIndex?'directory':'article',isDirectoryIndex,
        date:date(data,'date'),updated:date(data,'lastmod'),description:text('description'),comments:data.comments!==false&&(!data.unlisted||data.comments===true),
        reviewed:date(data,'reviewed'),reviewAfter:date(data,'reviewAfter'),staleAfter:data.staleAfter,stale:data.stale,
        body,tree:{type:'root',children:[]},headings:[],blocks:new Map(),links:[],html:'',plainText:'',readingText:'',summary:'',
      });
    }
  }
  await walk();
  const routes=new Set(['articles','journey','404','rss.xml','sitemap.xml']);
  for(const n of notes){
    const key=n.route.replace(/\/$/,'/index').normalize('NFC');
    if(routes.has(key)||/^(?:tags|data|_astro|media|fonts)(?:\/|$)/.test(key))throw new Error(`Conflicting public route: ${n.route}`);
    routes.add(key);
  }
  return {notes,files};
}
export async function contentFile(root:string,path:string) {
  safePath(path);if(classifyContentPath(path)!=='asset')throw new Error('Not a publishable asset');
  const base=await realpath(root),target=await realpath(resolve(base,path));
  if(relative(base,target).startsWith('..')||relative(base,target)==='')throw new Error('Asset outside content root');
  return target;
}
