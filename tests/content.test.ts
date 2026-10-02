import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {buildSnapshot} from '../src/content/snapshot';
import {readContent,routeFor,splitFrontmatter} from '../src/content/read';
import {withoutComments} from '../src/content/compile';
import {exportSearch} from '../src/search';
import {globalGraphData} from '../src/ui/graph';
import {calloutAliases} from '../src/markdown/callouts';
import {parseHTML} from 'linkedom';
import {url} from '../src/site.config';
const md=(body:string,meta='')=>`---\npublish: true\ntitle: Public\ndate: "2026-01-02"\n${meta}---\n${body}`;
async function fixture(files:Record<string,string>,run:(root:string)=>Promise<void>){
  const root=await mkdtemp(join(tmpdir(),'notes-test-'));
  try{for(const [path,body] of Object.entries(files)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),body);}await run(root);}finally{await rm(root,{recursive:true,force:true});}
}
test('publication precedes compilation and every discovery resource uses D',async()=>{
  await fixture({
    'index.md':md('Hello [[Hidden]] ![[Hidden]] ![[Secret]] ![[private/no.png]]','draft: true\n'),
    'listed.md':md('visible','tags: ["主题/系统"]\n'),
    'Hidden.md':md('UNLISTED_BODY_CANARY','unlisted: true\n'),
    'Secret.md':'---\npublish: false\ntitle: PRIVATE_TITLE_CANARY\n---\nPRIVATE_BODY_CANARY',
    'missing.md':'---\ntitle: PRIVATE_DEFAULT_CANARY\n---\nbody',
    'private/secret.md':md('PRIVATE_DIRECTORY_CANARY'),
    'private/no.png':'PRIVATE_ASSET_CANARY',
    'My Journey.base':'BASE_COORDINATE_CANARY: [11, 22]',
  },async root=>{
    const s=await buildSnapshot(root);assert.equal(s.notes.length,3);assert.equal(s.listed.length,2);assert.equal(s.assets.length,0);
    const search=await exportSearch(s.listed.map(n=>({id:n.id,url:n.url,title:n.title,aliases:n.aliases,tags:n.tags,summary:n.summary,text:n.plainText})));
    const publicData=JSON.stringify({html:s.listed.map(n=>n.html),search,graph:globalGraphData(s.listed)});
    for(const canary of ['PRIVATE_TITLE_CANARY','PRIVATE_BODY_CANARY','PRIVATE_DEFAULT_CANARY','PRIVATE_DIRECTORY_CANARY','PRIVATE_ASSET_CANARY','BASE_COORDINATE_CANARY','UNLISTED_BODY_CANARY'])assert.ok(!publicData.includes(canary),canary);
    assert.doesNotMatch(s.listed[0].html,/该内容未公开或不可用/);
    assert.ok(s.listed[0].html.includes(`href="${url('404')}"`));
    assert.equal(s.notes.find(n=>n.unlisted)?.comments,false);
  });
});
test('unavailable wiki, Markdown, reference and embed targets retain authored labels and native 404 popout links without revealing unpublished metadata',async()=>{
  await fixture({
    'a.md':md('[[00-Osaka-02|大阪 (Osaka)-Day1-梅田]]\n\n正文 [[Secret|作者写的标题]] 和 [[Missing]]。\n\n![[Secret|嵌入说明]]\n\n[**保留强调**](Secret.md)\n\n[引用的名称][absent]\n\n[absent]: Missing.md\n\n![[Hidden|未列出的嵌入]]\n\n[[B#不存在的章节|章节名称]]\n\n<a href="missing-html">HTML 名称</a>\n\n![图片说明](missing.png)\n\n![[sized-image.png|120x80]]\n\n[[B]] [[Hidden]]'),
    'Secret.md':'---\npublish: false\ntitle: PRIVATE_TITLE_CANARY\naliases: [PRIVATE_ALIAS_CANARY]\n---\nPRIVATE_BODY_CANARY',
    'Hidden.md':md('UNLISTED_BODY_CANARY','unlisted: true\n').replace('title: Public','title: UNLISTED_TITLE_CANARY'),
    'B.md':md('## 可见的章节\n\nPublic'),
  },async root=>{
    const s=await buildSnapshot(root),a=s.notes.find(n=>n.source==='a.md')!;
    const {document}=parseHTML(a.html);
    const fallback=[...document.querySelectorAll<HTMLAnchorElement>(`a[href="${url('404')}"]:not(.preview-button)`)];
    assert.deepEqual(fallback.map(link=>link.textContent),['大阪 (Osaka)-Day1-梅田','作者写的标题','Missing','嵌入说明','保留强调','引用的名称','未列出的嵌入','章节名称','HTML 名称']);
    assert.ok(fallback.find(link=>link.textContent==='保留强调')!.querySelector('strong'));
    for(const link of fallback){
      const pin=link.nextElementSibling!;
      assert.equal(pin.tagName,'A');assert.equal(pin.getAttribute('href'),url('404'));assert.ok(pin.classList.contains('preview-button'));
      assert.equal(link.hasAttribute('data-preview'),false);assert.equal(pin.hasAttribute('data-open-preview'),false);
    }
    assert.doesNotMatch(a.html,/该内容未公开或不可用|#unavailable|PRIVATE_(?:TITLE|ALIAS|BODY)_CANARY|UNLISTED_(?:TITLE|BODY)_CANARY/);
    assert.ok(document.querySelector(`a[href="${url('B')}"][data-preview="B.md"]`));
    assert.ok(document.querySelector(`a[href="${url('Hidden')}"]:not([data-preview])`));
    assert.deepEqual(a.links,['B.md','Hidden.md']);
  });
});
test('unavailable local images disappear without replacing their captions; valid images and explicit attachment links remain',async()=>{
  await fixture({
    'a.md':md('![[missing.jpeg|320]]\n_(在浦东机场用租的 Pocket3 拍的猫猫虫)_\n\n![MISSING_ALT](missing.png)\n_(Markdown 图注)_\n\n![MISSING_REF][image-ref]\n_(引用式图注)_\n\n[image-ref]: missing-reference.webp\n\n<img src="missing-html.png" alt="MISSING_HTML">\n\n_(HTML 图注)_\n\n![[private/no.jpg|PRIVATE_ALT]]\n\n![[ok.png|200]]\n_(正常图片的图注)_\n\n![远程图片](https://example.test/ok.jpg)\n\n[[missing.jpeg|显式附件链接]]'),
    'ok.png':'PUBLIC_IMAGE_BYTES',
    'private/no.jpg':'PRIVATE_IMAGE_CANARY',
  },async root=>{
    const s=await buildSnapshot(root),a=s.listed[0],{document}=parseHTML(a.html);
    assert.doesNotMatch(a.html,/该内容未公开或不可用|MISSING_(?:ALT|REF|HTML)|PRIVATE_(?:ALT|IMAGE_CANARY)|missing(?:-reference)?\.(?:png|webp)/);
    for(const caption of ['在浦东机场用租的 Pocket3 拍的猫猫虫','Markdown 图注','引用式图注','HTML 图注','正常图片的图注'])assert.ok([...document.querySelectorAll('p,figcaption')].some(node=>node.textContent!.includes(caption)),caption);
    const images=[...document.querySelectorAll('img')];assert.equal(images.length,2);
    assert.ok(images.some(image=>image.getAttribute('src')!.startsWith(url('media/'))));
    assert.ok(images.some(image=>image.getAttribute('src')==='https://example.test/ok.jpg'));
    assert.equal(document.querySelector(`a[href="${url('404')}"]:not(.preview-button)`)!.textContent,'显式附件链接');
    assert.equal(document.querySelectorAll('.preview-button').length,1);
    assert.deepEqual(s.assets.map(asset=>asset.source),['ok.png']);
  });
});
test('article titles use frontmatter without filename suffixes, falling back only for missing or blank titles',async()=>{
  await fixture({
    'folder/original.md':'---\npublish: true\ntitle: "  固定标题  "\n---\nBody',
    'moved/renamed.md':'---\npublish: true\ntitle: 固定标题\n---\nBody',
    'fallback.md':'---\npublish: true\n---\nBody',
    'blank.md':'---\npublish: true\ntitle: "  "\n---\nBody',
  },async root=>{
    const {notes}=await readContent(root),titles=new Map(notes.map(n=>[n.source,n.title]));
    assert.equal(titles.get('folder/original.md'),'固定标题');assert.equal(titles.get('moved/renamed.md'),'固定标题');
    assert.equal(titles.get('fallback.md'),'fallback');assert.equal(titles.get('blank.md'),'blank');
  });
});
test('strict frontmatter, date, YAML aliases and route collision checks',async()=>{
  assert.equal(splitFrontmatter('No metadata'),null);
  assert.throws(()=>splitFrontmatter('---\npublish: true\npublish: false\n---\n'));
  assert.equal(routeFor('资料/My Note.md'),'资料/My-Note');assert.equal(routeFor('资料/index.md'),'资料/');assert.throws(()=>routeFor('../escape.md'));
  await fixture({'a.md':md('a','lastmod: "2026-02-30"\n')},async root=>{await assert.rejects(readContent(root),/lastmod/);});
  await fixture({'a b.md':md('a'),'a-b.md':md('b')},async root=>{await assert.rejects(readContent(root),/Conflicting/);});
});
test('symlinks are rejected, ignored directories are not parsed',async()=>{
  await fixture({'private/broken.md':'---\n: invalid: yaml:\n---'},async root=>{
    assert.equal((await readContent(root)).notes.length,0);
    await symlink('/etc/passwd',join(root,'escape.md'));await assert.rejects(readContent(root),/Symbolic links/);
  });
});
test('comments do not leak into HTML or search; code syntax remains literal',async()=>{
  const source='before %% secret **bold**\n\n# SECRET_HEADING\n%% after\n\n`%%literal%% [[Code]]`\n\n```txt\n%%code%%\n```';
  assert.ok(!withoutComments(source).includes('SECRET_HEADING'));
  await fixture({'a.md':md(source)},async root=>{const s=await buildSnapshot(root);const n=s.notes[0];assert.ok(!n.html.includes('SECRET_HEADING'));assert.ok(!n.plainText.includes('SECRET_HEADING'));assert.match(n.html,/%%literal%% \[\[Code\]\]/);assert.match(n.html,/%%code%%/);});
});
test('two-pass links support aliases, headings, blocks, ambiguity and Unicode',async()=>{
  await fixture({
    'a.md':md('[[中文别名#章节]] [[B#^block]] [[Same]] [[../escape]]'),
    'B.md':md('## 章节\n\nA block. ^block','aliases: [中文别名]\n'),
    'x/Same.md':md('x'),'y/Same.md':md('y'),
  },async root=>{
    const s=await buildSnapshot(root),a=s.notes.find(n=>n.source==='a.md')!;
    assert.match(a.html,/href="\/B#%E7%AB%A0%E8%8A%82"/);assert.match(a.html,/href="\/B#block-block"/);
    assert.deepEqual(a.links,['B.md']);assert.ok(s.diagnostics.some(d=>d.code==='ambiguous-link'));
  });
});
test('heading wikilinks display resolved labels in the TOC while preserving old deep-link IDs',async()=>{
  await fixture({
    'a.md':md('[[courses#CMU 15-213 CS: APP]] [[courses#CMU 15-213 CS: APP#Exercises]]'),
    'courses.md':md('## [[01-courses/csapp/index|CMU 15-213]] CS: APP\n\n### **Exercises**\n\n## `[[literal|code]]`\n\n## [[Target]]'),
    '01-courses/csapp/index.md':md('Course'),'Target.md':md('Target'),
  },async root=>{
    const s=await buildSnapshot(root),course=s.notes.find(n=>n.source==='courses.md')!,a=s.notes.find(n=>n.source==='a.md')!;
    const heading=course.headings[0];
    assert.equal(heading.text,'CMU 15-213 CS: APP');
    assert.equal(heading.id,'01-coursescsappindexcmu-15-213-cs-app');
    assert.deepEqual(course.headings[1].trail,['CMU 15-213 CS: APP','Exercises']);
    assert.equal(course.headings[2].text,'[[literal|code]]');assert.equal(course.headings[3].text,'Target');
    assert.match(course.html,/id="01-coursescsappindexcmu-15-213-cs-app"/);
    assert.match(a.html,/href="\/courses#01-coursescsappindexcmu-15-213-cs-app"/);assert.match(a.html,/href="\/courses#exercises"/);
  });
});
test('section/block transclusion, cycles, scoped footnotes and authored edges',async()=>{
  await fixture({
    'a.md':md('![[B#Keep]]\n\n![[B#^block]]\n\n![[Cycle]]'),
    'B.md':md('## Keep\n\nText[^f] and [[C]].\n\n[^f]: Footnote\n\n## Drop\n\nNOT_SELECTED\n\nBlock only ^block'),
    'C.md':md('Target'), 'Cycle.md':md('![[a]]'),
  },async root=>{
    const s=await buildSnapshot(root),a=s.notes.find(n=>n.source==='a.md')!;
    assert.match(a.html,/Text/);assert.match(a.html,/Block only/);assert.ok(!a.html.includes('NOT_SELECTED'));
    assert.match(a.html,/循环引用/);assert.ok(!a.links.includes('C.md'));
    assert.match(a.html,/fn-.*embed-/);assert.match(a.html,/Footnote/);assert.ok(!a.plainText.includes('Text'));
  });
});
test('safe HTML, mathematical SVG, Shiki, inline footnotes and poetry',async()=>{
  await fixture({'a.md':md('==marked== ^[Inline note]\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n$x^2$\n\n```js\nconst x = 1\n```\n\n```poetry\nOne\nTwo\n```')},async root=>{
    const n=(await buildSnapshot(root)).notes[0];assert.match(n.html,/<mark>marked<\/mark>/);assert.match(n.html,/Inline note/);
    assert.ok(!n.html.includes('<script>'));assert.ok(!n.html.includes('onerror'));assert.match(n.html,/<svg/);assert.match(n.html,/shiki/);assert.match(n.html,/<pre[^>]*>[\s\S]*<code>[\s\S]*One[\s\S]*Two[\s\S]*<\/code><\/pre>/);assert.ok(!n.html.includes('One<br>'));
  });
});
test('27 callout identifiers, fold modes and nested callouts survive sanitization',async()=>{
  for(const kind of Object.keys(calloutAliases)){
    await fixture({'a.md':md(`> [!${kind.toUpperCase()}]- Title\n> Body\n>\n> > [!tip] Nested\n> > Inner`)},async root=>{
      const n=(await buildSnapshot(root)).notes[0];assert.match(n.html,new RegExp(`data-callout="${kind}"`));assert.match(n.html,/<details/);assert.match(n.html,/Nested/);assert.match(n.html,/callout-icon/);
    });
  }
});
test('only referenced allowed resources are emitted; embedded paths resolve at origin',async()=>{
  await fixture({'a.md':md('![[dir/B]]'),'dir/B.md':md('![[photo.png|120x80]]\n\n*Caption*'),'dir/photo.png':'PUBLIC_PNG','dir/orphan.png':'ORPHAN_CANARY','private/no.png':'PRIVATE_CANARY'},async root=>{
    const s=await buildSnapshot(root);assert.equal(s.assets.length,1);assert.equal(s.assets[0].source,'dir/photo.png');const a=s.notes.find(n=>n.source==='a.md')!;
    assert.match(a.html,/width="120"/);assert.match(a.html,/height="80"/);assert.match(a.html,/<figcaption>Caption<\/figcaption>/);
  });
});
