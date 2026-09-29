import {esc,tagURL} from './shared.mjs';
import {ArticleCard} from './article-card.mjs';
export function buildTags(notes){
  const groups=new Map();
  for(const note of notes){
    for(const tag of note.tags||[]){
      const parts=tag.split('/').filter(Boolean);
      for(let i=1;i<=parts.length;i++){
        const path=parts.slice(0,i).join('/');
        if(!groups.has(path))groups.set(path,new Map());groups.get(path).set(note.slug,note);
      }
    }
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b,'zh-CN')).map(([tag,items])=>({tag,url:tagURL(tag),notes:[...items.values()].sort((a,b)=>(b.updated||b.date||'').localeCompare(a.updated||a.date||'')||a.slug.localeCompare(b.slug,'en'))}));
}
export function TagPage(group,articleURL){
  const parts=group.tag.split('/');
  return `<main class="shell tag-page" id="main"><header class="page-intro"><div class="eyebrow">TAGGED NOTES</div><h1>#${esc(group.tag)}</h1><p class="archive-count">${group.notes.length} 篇内容</p>${parts.length>1?`<div class="article-tags">${parts.slice(0,-1).map((_,i)=>`<a class="tag" href="${tagURL(parts.slice(0,i+1).join('/'),'../')}">${esc(parts.slice(0,i+1).join('/'))}</a>`).join('')}</div>`:''}</header><ul class="tag-results">${group.notes.map(n=>`<li>${ArticleCard(n,{depth:2})}</li>`).join('')}</ul><a class="tag-back" href="${articleURL}">← 按目录浏览文章</a></main>`;
}
