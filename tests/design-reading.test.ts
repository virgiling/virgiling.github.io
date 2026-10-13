import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { buildSnapshot } from '../src/content/snapshot';
import { buildArchivePagination } from '../src/ui/archive-pagination';
import { seriesNavigation } from '../src/ui/series';
import { stackNotes, sortedFolders, type FolderNode } from '../src/ui/archive';
import type { CatalogNote } from '../src/ui/types';
import { renderComponent } from './helpers/render-astro';
import { url } from '../src/site.config';
import { folderFrameId } from '../src/ui/shared';

const doc = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const cards = (node: FolderNode): CatalogNote[] => [...stackNotes(node), ...sortedFolders(node.children.values()).flatMap(cards)];
const make = (n: number, root='courses'): CatalogNote => ({slug:`${root}/lab${n}`,source:`${root}/lab${n}.md`,url:url(`${root}/lab${n}`),title:`Lab ${n}`,summary:'Text',tags:[],date:`2026-01-${String(n%28+1).padStart(2,'0')}`,updated:'2026-10-01',kind:'article',publish:true});

test('summary extraction skips structural noise, prefers abstract bodies and preserves authored descriptions/search text',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-summary-'));
  const fixtures:Record<string,string>={
    table:'# Heading\n\n| a | b |\n|---|---|\n| one | two |\n\n正文第一句。后续文字。',
    callout:'> [!cite] Title\n> 引用正文\n\n正常正文。',
    abstract:'普通正文。\n\n> [!summary] 不应进入摘要的标题\n> 优先摘要正文。\n>\n> 后续摘要段落。',
    zero:'\u200B清理零宽字符。\uFEFF',
    code:'```js\nconsole.log("hello")\n```',
    long:'字'.repeat(140),
    links:'[[table|显示标签]] 是一段介绍。',
    self:'[]()\n\n[[self|本页]]\n\n## Section\n\n[[self#Section|本页章节]]',
  };
  try{
    for(const [name,body] of Object.entries(fixtures))await writeFile(join(root,`${name}.md`),`---\npublish: true\n---\n${body}`);
    await writeFile(join(root,'authored.md'),`---\npublish: true\ndescription: ${'作者'.repeat(80)}\n---\n# Heading\n\n正文。`);
    const snapshot=await buildSnapshot(root);
    const note=(name:string)=>snapshot.notes.find(n=>n.source===`${name}.md`)!;
    assert.equal(note('table').summary,'正文第一句。后续文字。');
    assert.match(note('table').plainText,/Heading.*one/);
    assert.equal(note('callout').summary,'正常正文。');
    assert.equal(note('abstract').summary,'优先摘要正文。 后续摘要段落。');
    assert.equal(note('zero').summary,'清理零宽字符。');
    assert.equal(note('code').summary,'code');
    assert.equal(note('long').summary,'字'.repeat(100)+'…');
    assert.equal(note('authored').summary,'作者'.repeat(80));
    assert.equal(note('links').summary,'显示标签 是一段介绍。');
    const code=doc(note('code').html);
    assert.equal(code.querySelector('.code-toolbar,.code-language'),null);
    assert.equal(code.querySelector('.code-block')!.children.length,1);
    assert.equal(code.querySelector('pre')!.getAttribute('tabindex'),'0');
    assert.match(code.querySelector('.code-block pre code')!.textContent,/console.log/);
    assert.equal(code.querySelector('button.copy-code'),null,'no inert copy button without JS');
    const self=doc(note('self').html);
    const pins=[...self.querySelectorAll('.preview-button')];
    assert.equal(pins.length,1,'keep chapter previews, not empty or whole-page self pins');
    assert.match(pins[0].getAttribute('aria-label')!,/本页章节/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('archive slices 53 articles into 20/20/13 within one frame, never by frame count',async()=>{
  const notes=Array.from({length:53},(_,i)=>make(i));
  const hidden={...make(99),unlisted:true};
  const tree=buildArchivePagination([...notes,hidden],{pageSize:20});
  assert.deepEqual(tree.pages.map(p=>cards(p.root).length),[20,20,13]);
  assert.deepEqual(tree.pages.map(p=>p.root.path),['courses','courses','courses']);
  assert.deepEqual(tree.pages.map(p=>p.part),[0,1,2]);
  assert.equal(new Set(tree.pages.flatMap(p=>cards(p.root).map(n=>n.slug))).size,53);
  const all: string[]=[];
  for(let i=0;i<tree.pages.length;i++){
    const rendered=doc(await renderComponent('Archive',{notes,pagination:tree,pageIndex:i}));
    assert.equal(rendered.querySelectorAll('.folder-frame').length,1);
    assert.ok(rendered.querySelector('#'+folderFrameId('courses')));
    const articles=[...rendered.querySelectorAll('[data-note]')].map(e=>e.getAttribute('data-note')!);
    all.push(...articles);
    assert.equal(articles.length,i===2?13:20);
    assert.match(rendered.querySelector('.frame-page')!.textContent,new RegExp(`${i+1} / 3`));
  }
  assert.equal(new Set(all).size,53);
  assert.throws(()=>buildArchivePagination(notes,{pageSize:0}),/page size/);
});

test('archive preserves child hierarchy, MoC identity and first-page legacy directory links',async()=>{
  const notes=[...Array.from({length:23},(_,i)=>make(i,'courses/sub')),make(1,'tools')];
  const moc={...make(1,'moc'),source:'courses-toc.md',slug:'courses-toc',url:url('courses-toc')};
  notes.push(moc);
  const config={pageSize:20,rootOrder:['courses','tools'],directories:[{path:'courses',title:'Courses',moc:{source:moc.source,title:moc.title,url:moc.url}}]};
  const pagination=buildArchivePagination(notes,config);
  assert.deepEqual(pagination.pages.map(p=>cards(p.root).length),[20,3,1]);
  assert.equal(pagination.pages[1].root.children.get('sub')!.notes.length,3);
  const first=doc(await renderComponent('Archive',{notes,config,pagination}));
  const second=doc(await renderComponent('Archive',{notes,config,pagination,pageIndex:1}));
  assert.equal(first.querySelectorAll('[data-directory-moc]').length,1);
  assert.equal(second.querySelectorAll('[data-directory-moc]').length,0);
  assert.equal(first.querySelector('#'+folderFrameId('tools'))!.getAttribute('href'),url('articles/3')+'#'+folderFrameId('tools'));
  assert.equal(pagination.directories.find(d=>d.path==='courses/sub')!.href,url('articles')+'#'+folderFrameId('courses/sub'));
});

test('series navigation uses creation dates with natural slug ties, public same-directory siblings and an index',async()=>{
  const a={...make(2),date:'2026-01-02',updated:'2026-12-01'},b={...make(10),date:'2026-01-02',updated:'2025-01-01'},c={...make(3),date:'2026-01-03'};
  const index={...make(0),source:'courses/index.md',isDirectoryIndex:true};
  const notes=[c,b,a,index,{...make(9),unlisted:true},make(1,'courses/child')];
  const archive=buildArchivePagination(notes,{pageSize:2});
  const model=seriesNavigation(b,notes,[],archive.directories)!;
  assert.equal(model.previous?.slug,a.slug);
  assert.equal(model.next?.slug,c.slug);
  assert.equal(model.index?.slug,index.slug);
  assert.equal(seriesNavigation(a,notes,[],archive.directories)!.previous,undefined);
  assert.equal(seriesNavigation(c,notes,[],archive.directories)!.next,undefined);
  assert.equal(seriesNavigation({...a,unlisted:true},notes,[],archive.directories),undefined);
  const rendered=doc(await renderComponent('SeriesNav',{model}));
  assert.equal(rendered.querySelector('[rel="prev"]')!.getAttribute('href'),a.url);
  assert.equal(rendered.querySelector('[rel="next"]')!.getAttribute('href'),c.url);
  assert.match(rendered.body.textContent,/系列目录/);
});
