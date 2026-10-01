import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {parseHTML} from 'linkedom';
import {buildSnapshot} from '../src/content/snapshot';
import {buildTags} from '../src/ui/tags';
import {graphModel,localGraphModel} from '../src/ui/graph';
import {exportSearch,importSearch} from '../src/search';
import {inlineTagParts,tagPath} from '../src/inline-tags';
import {renderComponent} from './helpers/render-astro';
import {renderTaggedText} from '../src/runtime/tagged-text';
const md=(body:string,extra='')=>`---\npublish: true\ntitle: Article\n${extra}---\n${body}`;
async function fixture(files:Record<string,string>,run:(root:string)=>Promise<void>){
  const root=await mkdtemp(join(tmpdir(),'inline-tags-'));
  try{for(const [path,body] of Object.entries(files)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),body);}await run(root);}finally{await rm(root,{recursive:true,force:true});}
}

test('inline tag tokens support CJK and nested tags without consuming code, URLs or escapes',()=>{
  const text='点击 #CCF，查看（#主题/计算机） #2026 #C++ `#Code` https://example.com/#URL \\#Escaped [[Note#Heading|#Alias]]';
  const parts=inlineTagParts(text);assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.flatMap(p=>p.tag?[p.tag]:[]),['CCF','主题/计算机','C']);
  assert.deepEqual(inlineTagParts('\\#CCF #CCF').filter(p=>p.tag).map(p=>p.tag),['CCF']);
  assert.deepEqual(inlineTagParts('https://example.com/#CCF #CCF','https://example.com/#CCF \\#CCF').filter(p=>p.tag),[]);
  assert.equal(tagPath('CCF'),'tags/434346');
  assert.equal(tagPath('主题/计算机'),'tags/'+Buffer.from('主题/计算机').toString('hex'));
  assert.deepEqual(inlineTagParts('#Literal #Live','\\#Literal #Live').filter(p=>p.tag).map(p=>p.tag),['Live']);
});

test('Markdown inline tags link to generated tag pages, including headings, tables, callouts and footnotes',async()=>{
  await fixture({'index.md':md('点击 #CCF。\n\n## Talk #CCF and `#Code`\n\n| Topic |\n| --- |\n| #主题/计算机 |\n\n> [!note] #Callout\n> #Inside\n\n==#Marked== and ^[#Footnote]\n\n`#Code` [#Linked](https://example.com) https://example.com/#URL \\#Escaped #2026\n\n```txt\n#Fence\n```')},async root=>{
    const s=await buildSnapshot(root),n=s.notes[0],{document}=parseHTML(`<html><body>${n.html}</body></html>`);
    assert.equal(document.querySelector('p a.inline-tag')?.getAttribute('href'),'/tags/434346');
    assert.ok(document.querySelector('h2 a.inline-tag[href="/tags/434346"]'));
    assert.ok(document.querySelector('table a.inline-tag'));assert.ok(document.querySelector('.callout-title a.inline-tag'));
    assert.ok(document.querySelector('mark a.inline-tag'));assert.match(n.html,/class="inline-tag"[^>]*>#Footnote/);
    assert.equal(document.querySelector('a a'),null);assert.equal(document.querySelector('code a'),null);
    assert.deepEqual(n.tags,[]);assert.deepEqual(new Set(n.tagMentions),new Set(['CCF','主题/计算机','Callout','Inside','Marked','Footnote']));
    assert.deepEqual(new Set(buildTags(s.listed).map(g=>g.tag)),new Set([...n.tagMentions,'主题']));
    assert.ok(buildTags(s.listed).every(g=>g.notes.length===0));
    assert.equal(n.headings[0].id,'talk-ccf-and-code');
    const toc=await renderComponent('OnThisPage',{headings:n.headings});
    const outline=parseHTML(`<html><body>${toc}</body></html>`).document;
    assert.ok(outline.querySelector('a.inline-tag[href="/tags/434346"]'));assert.equal(outline.querySelector('a a'),null);
    assert.equal([...outline.querySelectorAll('a.inline-tag')].some(a=>a.textContent==='#Code'),false);
  });
});

test('raw HTML text supports tags without interpreting attributes, authored links or code as tags',async()=>{
  await fixture({'a.md':md('<div title="#Attribute">Text #HTML <code>#CodeBlock</code> <a href="https://example.com">#Linked</a></div>\n\nText <code>#InlineCode</code> <a href="https://example.com">#InlineLink</a> #Live')},async root=>{
    const n=(await buildSnapshot(root)).notes[0],{document}=parseHTML(`<html><body>${n.html}</body></html>`);
    assert.deepEqual(n.tags,[]);assert.deepEqual(new Set(n.tagMentions),new Set(['HTML','Live']));
    assert.deepEqual([...document.querySelectorAll('a.inline-tag')].map(a=>a.textContent),['#HTML','#Live']);
    assert.equal(document.querySelector('code a'),null);assert.equal(document.querySelector('a a'),null);
  });
});

test('titles and descriptions contribute only tag mentions, and component links never nest inside their original destination',async()=>{
  await fixture({'article.md':'---\npublish: true\ntitle: "Guide #CCF"\ndescription: "More #主题/计算机"\n---\nBody'},async root=>{
    const n=(await buildSnapshot(root)).notes[0];assert.equal(n.title,'Guide #CCF');
    assert.deepEqual(n.tags,[]);assert.deepEqual(n.tagMentions,['CCF','主题/计算机']);
    const card=await renderComponent('ArticleCard',{note:n});
    const document=parseHTML(`<html><body>${card}</body></html>`).document;
    assert.ok(document.querySelector('.card-main-link[href="/article"]'));
    assert.ok(document.querySelector('h3 a.inline-tag[href="/tags/434346"]'));
    assert.ok(document.querySelector('.card-description a.inline-tag'));assert.equal(document.querySelector('a a'),null);
    assert.equal(document.querySelector('.card-tags'),null);
    const toc=await renderComponent('OnThisPage',{headings:[{id:'legacy',text:'#CCF',depth:2,trail:[]}],mobile:true});
    const outline=parseHTML(`<html><body>${toc}</body></html>`).document;
    assert.equal(outline.querySelector('[data-heading]')!.getAttribute('data-heading'),'legacy');
    assert.equal(outline.querySelector('a')!.getAttribute('href'),'/tags/434346');
    const link=await renderComponent('TaggedText',{text:'Guide #CCF <script>',tags:['CCF'],href:'/article'});
    const linked=parseHTML(`<html><body>${link}</body></html>`).document;
    assert.equal(linked.querySelector('script'),null);assert.equal(linked.querySelector('a a'),null);
    assert.deepEqual([...linked.querySelectorAll('a')].map(a=>a.getAttribute('href')),['/article','/tags/434346','/article']);
  });
});

test('friend introductions retain inline tags independently of their external card destination',async()=>{
  const html=await renderComponent('FriendCards',{friends:[{name:'Friend',url:'https://example.com/',bio:'Research #CCF'}],tags:['CCF']});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.ok(document.querySelector('.friend-main-link[href="https://example.com/"]'));
  assert.ok(document.querySelector('.friend-bio a[href="/tags/434346"]'));assert.equal(document.querySelector('a a'),null);
});

test('browser-created preview and search text uses the same safe base-aware tag destinations',()=>{
  const {document}=parseHTML('<html><body><p id="target"></p></body></html>');
  const target=document.querySelector<HTMLElement>('#target')!;
  renderTaggedText(target,'Guide #CCF <script> #Unknown',['CCF'],'/preview/');
  assert.equal(target.textContent,'Guide #CCF <script> #Unknown');assert.equal(target.querySelector('script'),null);
  assert.equal(target.querySelector('a')!.getAttribute('href'),'/preview/tags/434346');assert.equal(target.querySelectorAll('a').length,1);
  renderTaggedText(target,'Plain',[],'/preview/');assert.equal(target.textContent,'Plain');assert.equal(target.querySelector('a'),null);
});

test('tag mentions navigate without classifying the article or creating graph relationships',async()=>{
  await fixture({'mention.md':md('See #CCF and #主题/计算机 and #MentionOnly. [[member]]\n\n## Related #HeadingOnly','tags: [OwnCategory]\n'),'member.md':md('Member','tags: [CCF, 主题/计算机]\n')},async root=>{
    const s=await buildSnapshot(root),mention=s.notes.find(n=>n.source==='mention.md')!,member=s.notes.find(n=>n.source==='member.md')!;
    assert.deepEqual(mention.tags,['OwnCategory']);assert.deepEqual(member.tags,['CCF','主题/计算机']);
    assert.match(mention.html,/href="\/tags\/434346"/);assert.deepEqual(mention.links,['member.md']);
    const groups=buildTags(s.listed);assert.deepEqual(groups.find(g=>g.tag==='CCF')!.notes.map(n=>n.slug),['member.md']);
    assert.deepEqual(groups.find(g=>g.tag==='主题')!.notes.map(n=>n.slug),['member.md']);
    assert.deepEqual(groups.find(g=>g.tag==='MentionOnly')!.notes,[]);
    const graph=graphModel(null,s.listed),local=localGraphModel(mention,s.listed);
    assert.ok(graph.edges.some(e=>e.from==='page:mention.md'&&e.to==='page:member.md'&&e.type==='page-link'));
    assert.deepEqual(graph.edges.filter(e=>e.from==='page:mention.md'&&e.type==='tag-membership').map(e=>e.to),['tag:OwnCategory']);
    assert.ok(!graph.nodes.some(n=>n.id==='tag:MentionOnly'||n.id==='tag:HeadingOnly'));
    assert.ok(!local.nodes.some(n=>n.id==='tag:CCF'||n.id==='tag:主题/计算机'));
    const search=importSearch(await exportSearch(s.listed.map(n=>({id:n.id,url:n.url,title:n.title,aliases:n.aliases,tags:n.tags,summary:n.summary,text:n.plainText}))));
    assert.deepEqual(search('#CCF').map(n=>n.id),['member.md']);assert.equal(search('#MentionOnly').length,0);
    assert.ok(search('MentionOnly').some(n=>n.id==='mention.md'));
  });
});

test('inline tags respect publication and transclusion boundaries',async()=>{
  await fixture({'a.md':md('![[b]]\n\n#Public'),'b.md':md('#Embedded'),'hidden.md':md('#HiddenOnly','unlisted: true\n'),'private.md':'---\npublish: false\n---\n#Private'},async root=>{
    const s=await buildSnapshot(root),a=s.notes.find(n=>n.source==='a.md')!,hidden=s.notes.find(n=>n.unlisted)!;
    assert.deepEqual(a.tags,[]);assert.deepEqual(a.tagMentions,['Public']);assert.match(a.html,/#Embedded<\/a>/);
    assert.equal(hidden.html.includes('class="inline-tag"'),false);
    assert.deepEqual(new Set(buildTags(s.listed).map(g=>g.tag)),new Set(['Public','Embedded']));
  });
});
