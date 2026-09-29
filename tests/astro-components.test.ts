import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderComponent} from './helpers/render-astro';
import {readingMinutes} from '../src/ui/reading';
import {buildTags} from '../src/ui/tags';
import {articleActivity} from '../src/ui/home-activity';
import {freshnessStatus} from '../src/ui/freshness';
import {siteConfig,url} from '../src/site.config';
import type {CatalogNote} from '../src/ui/types';
const article:CatalogNote={slug:'a',source:'01-courses/a.md',url:'/a',title:'A <script> & "title"',summary:'A <summary>',kind:'article',tags:[],date:'2026-01-02',updated:'2026-03-04'};

test('reading metadata preserves icons and dates without Published or Last updated labels',async()=>{
  const note={date:'2026-01-02',updated:'2026-03-04',readingText:'汉'.repeat(600),plainText:''};
  const html=await renderComponent('ReadingMeta',{note});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.deepEqual([...document.querySelectorAll('time')].map(n=>n.getAttribute('datetime')),[note.date,note.updated]);
  assert.deepEqual([...document.querySelectorAll('.meta-icon')].map(n=>n.textContent),['✏️','🔧']);
  assert.equal(document.querySelector('.read-time')!.textContent,'2 min read');
  assert.doesNotMatch(html,/Published|Last updated/);
  const empty=await renderComponent('ReadingMeta',{note:{...note,date:'',updated:'',readingText:''}});
  assert.doesNotMatch(empty,/<time/);assert.match(empty,/1 min read/);
  assert.equal(readingMinutes({plainText:'word '.repeat(400),readingText:''},{cjkPerMinute:300,wordsPerMinute:200}),2);
});

test('article cards escape authored text and preserve date placement, stack hooks and heading depth',async()=>{
  for(const tags of [[],['one','two','three'],['one','two','three','four']]){
    const note={...article,tags};
    const html=await renderComponent('ArticleCard',{note,depth:4,stackIndex:1});
    const {document}=parseHTML(`<html><body>${html}</body></html>`);
    assert.equal(document.querySelector('h4')!.textContent,note.title);assert.equal(document.querySelector('script'),null);
    assert.equal(document.querySelector('.card-description')!.textContent,note.summary);
    assert.equal(document.querySelector('.note-card')!.getAttribute('data-note'),note.slug);
    assert.equal(document.querySelectorAll('.card-created').length,1);
    assert.ok(document.querySelector(tags.length>3?'.card-title-row time':'.card-footer time'));
    assert.equal(document.querySelectorAll('.card-tags .tag').length,tags.length);
    assert.equal(document.querySelector('.ghost-title')!.textContent,'↳ '+note.title);
    assert.match(document.querySelector('.stack-card')!.getAttribute('style')!,/--i:1;z-index:99/);
  }
  const noDate=await renderComponent('ArticleCard',{note:{...article,date:''}});assert.doesNotMatch(noDate,/card-created|card-footer|ghost-title/);
});

test('table of contents preserves historical anchors, escaped labels, depth and mobile semantics',async()=>{
  const headings=[{id:'legacy|链接 & "x"',text:'A <heading>',depth:2,trail:[]},{id:'deep',text:'Hidden',depth:4,trail:[]}];
  const html=await renderComponent('OnThisPage',{headings,mobile:true});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelectorAll('.toc a').length,1);
  assert.equal(document.querySelector('.toc a')!.getAttribute('href'),'#'+encodeURIComponent(headings[0].id));
  assert.equal(document.querySelector('.toc a')!.getAttribute('data-heading'),headings[0].id);
  assert.equal(document.querySelector('.toc a')!.textContent,headings[0].text);
  assert.equal(document.querySelector('nav')!.getAttribute('aria-label'),'移动端 ON THIS PAGE');
  assert.ok(document.querySelector('.toc-marker[hidden]'));
});

test('freshness uses the existing callout contract and respects scheduled reviews and explicit opt-out',async()=>{
  const note={...article,reviewed:'',reviewAfter:''};
  const html=await renderComponent('FreshnessNotice',{note,asOf:'2027-03-05'});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.ok(document.querySelector('aside.freshness-notice[data-callout="warning"] .callout-title .callout-icon svg'));
  assert.match(document.querySelector('.callout-content p')!.textContent,/2026-03-04.*365 天/);
  const review=await renderComponent('FreshnessNotice',{note:{...note,reviewAfter:'2026-03-01'},asOf:'2026-03-04'});assert.match(review,/逾期 3 天/);
  const disabled=await renderComponent('FreshnessNotice',{note:{...note,stale:false},asOf:'2027-03-05'});assert.doesNotMatch(disabled,/<aside/);
  assert.throws(()=>freshnessStatus(note,siteConfig.freshness,'invalid'),/Invalid freshness/);
});

test('tag pages retain ancestor links and reuse safe article cards',async()=>{
  const group=buildTags([{...article,tags:['topic/deep']}]).find(group=>group.tag==='topic/deep')!;
  const html=await renderComponent('TagPage',{group,articleURL:url('articles')});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelector('h1')!.textContent,'#topic/deep');
  assert.equal(document.querySelector('.article-tags a')!.getAttribute('href'),url('tags/'+Buffer.from('topic').toString('hex')));
  assert.equal(document.querySelectorAll('.tag-results .note-card').length,1);assert.equal(document.querySelector('script'),null);
});

test('graph SVG escapes labels, truncates by code point and keeps hidden notes local',async()=>{
  const title='<script>not HTML</script>',label='🙂'.repeat(25);
  const note={slug:'current',source:'hidden.md',url:'/hidden',title,graphLabel:label,links:['neighbor'],tags:['private-tag'],headings:[],unlisted:true};
  const pages=[{...note,slug:'neighbor',source:'neighbor.md',url:'/neighbor',title:'Neighbor',unlisted:false,tags:[],links:['current']}];
  const html=await renderComponent('ReadingSidebar',{note,pages});
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelector('script'),null);
  const current=document.querySelector('a[aria-current="page"]')!;
  assert.equal(current.querySelector('title')!.textContent,title);
  assert.equal(current.querySelector('text')!.textContent,'🙂'.repeat(17)+'…');
  assert.equal(document.querySelector('.graph-tag'),null);
  assert.equal(document.querySelectorAll('a.graph-page').length,2);
  assert.equal(document.querySelector('.backlinks a')!.getAttribute('href'),'/neighbor');
});

test('activity models reject invalid dates, filter private entries and retain deterministic counts',()=>{
  const activity=articleActivity([article,{...article,slug:'hidden',unlisted:true},{...article,slug:'private',publish:false}],{heatmapWeeks:1});
  assert.equal(activity.recent.length,1);assert.equal(activity.days.length,7);assert.equal(activity.counts[0].count,1);
  assert.throws(()=>articleActivity([{...article,updated:'2026-02-30'}]),/Invalid article activity date/);
  assert.throws(()=>articleActivity([],{heatmapWeeks:54}),/Invalid home activity/);
  assert.deepEqual(articleActivity([]).recent,[]);
});
