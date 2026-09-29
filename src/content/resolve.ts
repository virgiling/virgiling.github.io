import { posix } from 'node:path';
import { slug } from 'github-slugger';
import type { Note, Diagnostic } from './types';
const normalize=(s:string)=>s.normalize('NFC').replace(/\.md$/i,'');
export class Resolver {
  paths=new Map<string,Note>(); names=new Map<string,Set<Note>>();
  constructor(public notes:Note[],public diagnostics:Diagnostic[]) {
    for(const n of notes){
      this.paths.set(normalize(n.source),n);
      for(const name of [posix.basename(n.source,'.md'),...n.aliases]){
        const key=normalize(name);if(!this.names.has(key))this.names.set(key,new Set());this.names.get(key)!.add(n);
      }
    }
  }
  resolve(from:Note,raw:string,{embed=false}={}) {
    let target:string;try{target=decodeURIComponent(raw).normalize('NFC');}catch{return undefined;}
    if(target.includes('\\')||target.includes('\0')||/^[a-z][\w+.-]*:/i.test(target)||target.startsWith('//'))return undefined;
    const hash=target.indexOf('#'),path=normalize(hash<0?target:target.slice(0,hash)),fragment=hash<0?'':target.slice(hash+1);
    const relative=posix.normalize(posix.join(posix.dirname(from.source),path));
    if(path.split('/').includes('..')&&relative.startsWith('../'))return undefined;
    let note:Note|undefined;
    if(!path)note=from;
    else if(path.startsWith('./')||path.startsWith('../'))note=this.paths.get(relative);
    else note=this.paths.get(path.replace(/^\//,''))||this.paths.get(relative);
    if(!note&&path){
      const matches=this.names.get(path);
      if(matches?.size===1)note=[...matches][0];
      else if(matches?.size){this.warn(from,'ambiguous-link','Link has multiple published targets');return undefined;}
    }
    if(!note){this.warn(from,'unavailable-link','Target is missing or not public');return undefined;}
    // Explicit links may reach an unlisted page, but listed pages cannot embed it.
    if(embed&&note.unlisted&&!from.unlisted){this.warn(from,'unlisted-embed','Unlisted transclusion denied');return undefined;}
    let anchor='';
    if(fragment.startsWith('^')){
      const block=fragment.slice(1);if(!note.blocks.has(block)){this.warn(from,'missing-anchor','Block not found');return undefined;}anchor=`block-${block}`;
    } else if(fragment){
      const parts=fragment.split('#').map(s=>s.trim());
      const heading=note.headings.find(h=>h.id===fragment)||note.headings.find(h=>parts.length===1?(h.text===fragment||h.id===slug(fragment)):parts.every((part,i)=>h.trail.slice(-parts.length)[i]===part));
      if(!heading){this.warn(from,'missing-anchor','Heading not found');return undefined;}anchor=heading.id;
    }
    return {note,anchor,href:note.url+(anchor?'#'+encodeURIComponent(anchor):'')};
  }
  warn(note:Note,code:string,message:string){this.diagnostics.push({source:note.source,code,message});}
}
