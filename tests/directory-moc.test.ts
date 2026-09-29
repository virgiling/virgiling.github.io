import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'parse5';
import {mapDirectoryMocs} from '../src/content/directory-moc';
import {buildSnapshot} from '../src/content/snapshot';
import {buildFolderTree} from '../src/ui/archive';
import {renderComponent} from './helpers/render-astro';
import type {Diagnostic,DirectoryMeta} from '../src/content/types';
const note=(source:string)=>({id:source,slug:source,source,url:'/preview/'+source.replace(/\.md$/i,''),title:source,publish:true as const,unlisted:false,kind:'article' as const,isDirectoryIndex:false,tags:[],date:'',updated:'',summary:'Summary'});
const attrs=(n:any)=>Object.fromEntries((n.attrs||[]).map((a:{name:string;value:string})=>[a.name,a.value]));
function find(n:any,p:(n:any)=>boolean):any[]{return [...(p(n)?[n]:[]),...(n.childNodes||[]).flatMap((n:any)=>find(n,p))];}
const text=(n:any):string=>n.value??(n.childNodes||[]).map(text).join('');

test('root and same-directory MoCs match top-level names, keeping public labels and exact base-aware URLs',()=>{
  const pages=[note('01-courses/a.md'),note('03-tools/b.md'),note('COURSES-toc.md'),note('03-tools/tools-toc.md')];
  const dirs=mapDirectoryMocs(pages,[{path:'01-courses',title:'公开课实验'},{path:'03-tools',title:'差生文具店'}]);
  assert.equal(dirs[0].title,'公开课实验');assert.equal(dirs[0].moc?.url,'/preview/COURSES-toc');
  assert.equal(dirs[1].moc?.source,'03-tools/tools-toc.md');
  assert.ok(!pages.some(n=>n.isDirectoryIndex),'Mapping must not reclassify or relocate source notes');
});

test('unlisted/unpublished candidates cannot create or retain heading links',()=>{
  const publicMoc=note('courses-toc.md'),dirs=mapDirectoryMocs([note('01-courses/a.md'),publicMoc],[]);
  assert.ok(dirs[0].moc);
  const hidden=mapDirectoryMocs([note('01-courses/a.md'),{...publicMoc,unlisted:true}],dirs);
  assert.ok(!hidden[0].moc,'Previously computed metadata must not retain an unlisted link');
  const unpublished={...publicMoc,publish:false} as unknown as ReturnType<typeof note>;
  assert.ok(!mapDirectoryMocs([note('01-courses/a.md'),unpublished],dirs)[0].moc);
});

test('ambiguous MoCs or equally named root folders fail closed with public-only diagnostics',()=>{
  const warnings:Diagnostic[]=[];
  const dirs=mapDirectoryMocs([note('courses-toc.md'),note('01-courses/courses-toc.md')],[{path:'01-courses',title:'Courses'}],warnings);
  assert.ok(!dirs[0].moc);assert.equal(warnings[0].code,'ambiguous-directory-moc');
  const collisions=mapDirectoryMocs([note('courses-toc.md')],[{path:'01-courses',title:'One'},{path:'02-courses',title:'Two'}],warnings);
  assert.ok(collisions.every(d=>!d.moc));assert.equal(warnings.length,2);
});

test('unmatched and nested outlines stay cards; a public MoC-only directory retains its heading',async()=>{
  const notes=[note('orphan-toc.md'),note('01-courses/sub/sub-toc.md'),note('tools-toc.md')];
  const dirs=mapDirectoryMocs(notes,[{path:'03-tools',title:'Tools'}]);
  const roots=buildFolderTree(notes,dirs);
  assert.equal(roots.find(n=>n.path==='03-tools')!.moc!.source,'tools-toc.md');
  const html=await renderComponent('Archive',{notes,config:{directories:dirs}});
  assert.ok(html.includes('data-note="orphan-toc.md"'));assert.ok(html.includes('data-note="01-courses/sub/sub-toc.md"'));
  assert.ok(html.includes('data-directory-moc="tools-toc.md"'));assert.ok(!html.includes('data-note="tools-toc.md"'));
});

test('archive represents each MoC once as a native heading link, preserving labels, indexes and counts',async()=>{
  const notes=[note('01-courses/a.md'),{...note('01-courses/index.md'),isDirectoryIndex:true},note('courses-toc.md')];
  const dirs=mapDirectoryMocs(notes,[{path:'01-courses',title:'Courses & notes'}]);
  const html=await renderComponent('Archive',{notes,config:{directories:dirs}}),tree=parse(html);
  const links=find(tree,n=>'data-directory-moc' in attrs(n));assert.equal(links.length,1);
  assert.equal(links[0].tagName,'a');assert.equal(links[0].parentNode.tagName,'h2');
  assert.equal(attrs(links[0]).href,'/preview/courses-toc');assert.equal(text(find(links[0],n=>attrs(n).class==='folder-heading-name')[0]),'Courses & notes');
  assert.equal(text(links[0]).trim(),'Courses & notes');assert.equal(find(links[0],n=>attrs(n).class==='folder-link-arrow').length,1);
  assert.equal(find(tree,n=>'data-note' in attrs(n)).length,2);assert.ok(!html.includes('data-folder-root=""'));
  assert.ok(text(tree).includes('3 则笔记，慢慢生长。'));assert.ok(!html.includes('篇目录导读'));assert.ok(!html.includes('按目录浏览'));
  assert.ok(html.indexOf('data-note="01-courses/index.md"')<html.indexOf('data-note="01-courses/a.md"'));
});

test('garden summary counts unique notes and explicit themes, not synthesized tag ancestors',async()=>{
  const a={...note('a.md'),tags:['topic/sub']},b={...note('b.md'),tags:['topic/sub','tools']};
  const tree=parse(await renderComponent('Archive',{notes:[a,b,a]}));
  assert.equal(text(find(tree,n=>attrs(n).class==='archive-count')[0]),'2 则笔记，2 个主题，慢慢生长。');
});

test('snapshot plugin integrates only discoverable MoCs; breadcrumbs share links without changing page identity',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-directory-moc-'));
  try{
    await mkdir(join(root,'01-courses/sub'),{recursive:true});
    await writeFile(join(root,'01-courses/index.md'),'---\npublish: true\ntitle: 公开课实验\n---\n');
    await writeFile(join(root,'01-courses/sub/index.md'),'---\npublish: true\ntitle: 子目录\n---\nA real guide');
    await writeFile(join(root,'01-courses/sub/lesson.md'),'---\npublish: true\n---\nLesson');
    await writeFile(join(root,'courses-toc.md'),'---\npublish: true\ntitle: MoC\n---\n[[01-courses/sub/lesson]]');
    await writeFile(join(root,'01-courses/courses-toc.md'),'---\npublish: true\nunlisted: true\n---\nUNLISTED_MOC_CANARY');
    const snapshot=await buildSnapshot(root),moc=snapshot.listed.find(n=>n.source==='courses-toc.md')!;
    assert.equal(moc.route,'courses-toc');assert.equal(moc.kind,'article');assert.ok(moc.links.includes('01-courses/sub/lesson.md'));
    const html=await renderComponent('Archive',{notes:snapshot.listed,config:{directories:snapshot.directories}});assert.ok(!html.includes('UNLISTED_MOC_CANARY'));
    const lesson=snapshot.listed.find(n=>n.source.endsWith('lesson.md'))!;
    const crumbs=await renderComponent('Breadcrumbs',{note:lesson,pages:snapshot.listed,directories:snapshot.directories});
    assert.ok(crumbs.includes('href="/courses-toc"'));assert.ok(crumbs.includes('href="/01-courses/sub/"'));
    const fallback:DirectoryMeta[]=[{path:'01-courses',title:'公开课实验'}];
    assert.ok((await renderComponent('Breadcrumbs',{note:lesson,pages:snapshot.listed,directories:fallback})).includes('/articles#frame-folder-'));
  }finally{await rm(root,{recursive:true,force:true});}
});
