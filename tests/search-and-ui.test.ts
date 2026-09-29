import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportSearch,importSearch} from '../src/search';
import {commentAllowed,giscusAttributes} from '../src/runtime/comments';
import {buildFolderTree} from '../src/ui/archive';
import {buildTags} from '../src/ui/tags';
import {renderComponent} from './helpers/render-astro';
import {siteConfig,discussionURL} from '../src/site.config';
const note=(id:string,tags:string[]=[])=>({id,slug:id,source:id,title:id,url:'/'+id.replace('.md',''),tags,kind:'article' as const,links:[],headings:[],summary:'Summary',date:'2026-01-01',updated:'2026-02-01'});
test('FlexSearch serialized roundtrip: CJK, mixed text, alias, AND tags and title priority',async()=>{
  const records=[
    {id:'a',title:'内存管理',url:'/a',aliases:['COW alias'],text:'操作系统 xv6 实验',summary:'A',tags:['主题/操作系统','平台/Linux']},
    {id:'b',title:'xv6',url:'/b',aliases:[],text:'内存管理 操作系统',summary:'B',tags:['主题/操作系统']},
  ];
  const data=await exportSearch(records);assert.ok(Object.keys(data.title).length>0);
  const search=importSearch(JSON.parse(JSON.stringify(data)));
  assert.equal(search('内存')[0].id,'a');assert.equal(search('xv6')[0].id,'b');assert.equal(search('cow')[0].id,'a');
  assert.deepEqual(search('操作系统 #Linux #主题').map((n:{id:string})=>n.id),['a']);assert.equal(search('#系统').length,0);
  assert.equal(search('不存在').length,0);assert.equal(search('#主题').length,2);assert.equal(search('ｘｖ６ #Linux').length,1);
});
test('real comments work on localhost and HTTP previews; explicit disable and opaque origins stay off',()=>{
  for(const origin of ['http://localhost:4321','http://127.0.0.1:4322','http://[::1]:4321','http://192.168.1.2:4321','https://virgiling.wiki','https://preview.example'])assert.equal(commentAllowed(origin),true,origin);
  assert.equal(commentAllowed('http://localhost:4321',false),false);
  for(const origin of ['null','file://','javascript:alert(1)'])assert.equal(commentAllowed(origin),false);
  assert.equal(siteConfig.comments.enabled,true);
  const attrs=giscusAttributes({...siteConfig.comments,term:discussionURL('about')});assert.equal(attrs['data-mapping'],'specific');assert.equal(attrs['data-term'],'https://virgiling.wiki/about');assert.equal(attrs['data-strict'],'1');assert.equal(attrs['data-theme'],'light');assert.equal(attrs['data-lang'],'zh-CN');
});
test('discussion identities preserve the public URL and are independent of local origin or preview base',()=>{
  assert.equal(discussionURL(),'https://virgiling.wiki/');assert.equal(discussionURL('01-courses/'),'https://virgiling.wiki/01-courses/');
  assert.equal(discussionURL('03-tools/dotfiles'),'https://virgiling.wiki/03-tools/dotfiles');assert.equal(new URL(discussionURL('//evil.test')).origin,'https://virgiling.wiki');
  assert.equal(new URL(discussionURL('中文')).pathname,'/%E4%B8%AD%E6%96%87');
});
test('recursive archive keeps each source once, directory lead first and tags separate',async()=>{
  const notes=[note('folder/a.md',['topic/a','topic/b']),note('folder/sub/b.md'),{...note('folder/index.md'),isDirectoryIndex:true}];
  const roots=buildFolderTree(notes,[{path:'folder',title:'Public folder'}]);
  assert.equal(roots[0].label,'Public folder');assert.equal(roots[0].notes.length,2);assert.equal(roots[0].children.get('sub')!.notes.length,1);
  const html=await renderComponent('Archive',{notes});assert.equal((html.match(/data-note="folder\/a.md"/g)||[]).length,1);assert.ok(html.indexOf('data-note="folder/index.md"')<html.indexOf('data-note="folder/a.md"'));
  const groups=buildTags(notes);assert.equal(groups.find(g=>g.tag==='topic')!.notes.length,1);
});
test('homepage sidebar order differs from reading pages without fabricating backlinks',async()=>{
  const home={...note('index.md'),kind:'landing'},about={...note('about.md'),kind:'landing',links:['index.md']};
  const html=await renderComponent('ReadingSidebar',{note:home,pages:[home,about],config:siteConfig});assert.ok(html.indexOf('最近更新')<html.indexOf('关系图谱'));assert.ok(!html.includes('反向链接'));
  const other=await renderComponent('ReadingSidebar',{note:about,pages:[home,about],config:siteConfig});assert.match(other,/反向链接 <small>0/);
});
