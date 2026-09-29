import {esc,folderId,folderFrameId} from './shared.mjs';
import {ArticleCard} from './article-card.mjs';
import {classifyContentPath} from '../content-policy.mjs';
// One canonical source path per note. Tags are metadata, never archive membership.
export function buildFolderTree(notes,directories=[]){
  const roots=new Map(),seen=new Map(),titles=new Map(directories.map(d=>[d.path,d.title]));
  for(const note of notes){
    if(classifyContentPath(note.source)!=='markdown')throw new Error(`Archive requires a public Markdown source: ${note.source}`);
    if(seen.has(note.slug)){if(seen.get(note.slug)!==note.source)throw new Error(`Conflicting source paths for ${note.slug}`);continue;}
    seen.set(note.slug,note.source);
    const folders=note.source.replaceAll('\\','/').split('/').slice(0,-1),parts=folders.length?folders:[''];
    let siblings=roots,path='';
    for(let i=0;i<parts.length;i++){
      path+=(path?'/':'')+parts[i];
      if(!siblings.has(parts[i]))siblings.set(parts[i],{label:titles.get(path)||parts[i]||'根目录',path,children:new Map(),notes:[],members:new Set()});
      const node=siblings.get(parts[i]);node.members.add(note.slug);
      if(i===parts.length-1)node.notes.push(note);siblings=node.children;
    }
  }
  // A MoC is represented once: by its directory heading, not another root card.
  const bySource=new Map(notes.map(n=>[n.source,n])),mapped=new Set();
  for(const directory of directories){
    if(!directory.path||directory.path.includes('/')||!directory.moc)continue;
    const moc=bySource.get(directory.moc.source);
    if(!moc||moc.publish!==true||moc.unlisted||mapped.has(moc.source))continue;
    if(!roots.has(directory.path))roots.set(directory.path,{label:directory.title,path:directory.path,children:new Map(),notes:[],members:new Set()});
    roots.get(directory.path).moc=moc;mapped.add(moc.source);
  }
  function prune(nodes){
    for(const [key,node] of nodes){
      node.notes=node.notes.filter(n=>!mapped.has(n.source));prune(node.children);
      node.members=new Set([...node.notes.map(n=>n.slug),...[...node.children.values()].flatMap(n=>[...n.members]),...(node.moc?[node.moc.slug]:[])]);
      if(!node.members.size)nodes.delete(key);
    }
  }
  prune(roots);
  return [...roots.values()];
}
function Heading(node){
  const label=esc(node.label);
  return node.moc?`<a class="folder-heading-link" href="${esc(node.moc.url)}" data-directory-moc="${esc(node.moc.source)}"><span class="folder-heading-name">${label}</span> <span class="folder-link-hint"><svg class="folder-link-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h10M8 3l5 5-5 5"/></svg></span></a>`:label;
}
function Stack(node,depth){
  const isIndex=n=>n.isDirectoryIndex||/(?:^|\/)index\.md$/.test(n.source);
  const notes=[...node.notes].sort((a,b)=>Number(Boolean(isIndex(b)))-Number(Boolean(isIndex(a)))||String(b.date||'').localeCompare(a.date||'')||a.slug.localeCompare(b.slug,'en'));
  if(!notes.length)return '';
  const id=folderId(node.path),label=node.label,count=`${notes.length} 则笔记`;
  return `<div class="card-stack${notes.length===1?' single':''}" data-folder="${esc(label)}" id="${id}" style="--stack-count:${Math.min(notes.length,3)}">${notes.length>1?`<button type="button" class="stack-count" aria-label="${esc(label)}：${count}，收起" aria-expanded="true" aria-controls="deck-${id}" disabled>${count}</button>`:`<span class="stack-count">${count}</span>`}<div class="stack-deck" id="deck-${id}">${notes.map((n,i)=>ArticleCard(n,{depth:Math.min(depth+1,6),stackIndex:i})).join('')}</div></div>`;
}
const sorted=nodes=>[...nodes].sort((a,b)=>a.path.localeCompare(b.path,'en'));
function Branch(node,depth){return `<section class="folder-subframe" id="${folderFrameId(node.path)}" data-folder-path="${esc(node.path)}"><h${Math.min(depth,6)} class="folder-branch-heading"><span aria-hidden="true">↳</span>${esc(node.label)}</h${Math.min(depth,6)}>${Stack(node,depth)}${sorted(node.children.values()).map(child=>Branch(child,depth+1)).join('')}</section>`;}
export function Archive(notes,config={}){
  const roots=buildFolderTree(notes,config.directories),order=config.rootOrder||[];
  const count=new Set(notes.map(n=>n.slug)).size,themes=new Set(notes.flatMap(n=>n.tags||[])).size;
  roots.sort((a,b)=>(order.includes(a.path)?order.indexOf(a.path):order.length)-(order.includes(b.path)?order.indexOf(b.path):order.length)||a.path.localeCompare(b.path,'en'));
  return `<main class="shell archive-page" id="main"><div class="page-intro"><div class="eyebrow">A DIGITAL GARDEN</div><h1>文章</h1><p class="archive-count">${count} 则笔记，${themes?`${themes} 个主题，`:''}慢慢生长。</p></div><div class="folder-tree">${roots.map((root,i)=>`<section class="folder-frame" id="${folderFrameId(root.path)}" data-folder-root="${esc(root.path)}" aria-labelledby="root-${folderId(root.path)}"><header class="folder-frame-header"><span class="frame-number">${String(i+1).padStart(2,'0')}</span><h2 id="root-${folderId(root.path)}">${Heading(root)}</h2></header>${Stack(root,2)}${sorted(root.children.values()).map(child=>Branch(child,3)).join('')}</section>`).join('')}</div></main>`;
}
