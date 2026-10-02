import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {parseHTML,DOMParser} from 'linkedom';
import {extractPreviewContent,createPreviewLoader} from '../src/runtime/preview-content';
import {rect} from './helpers/dom';

const article=(id='b.md')=>`<!doctype html><html><body><header>Navigation</header><article data-note-id="${id}"><header class="article-header" data-preview-content><h1 id="page-title">Full article</h1><div class="article-tags"><a class="tag" href="../tags/434346">CCF</a></div></header><div class="prose" data-preview-content><p>Opening paragraph</p><details><summary>Callout</summary><h2 id="chapter">Chapter</h2></details><p>${'Full content. '.repeat(120)}End of the entire article.</p><a href="#chapter" data-preview="b.md">Chapter link</a><button class="preview-button" data-open-preview="b.md">Pin</button><a href="#fn1" aria-describedby="fn1">Footnote</a><p id="fn1">Note</p><svg><defs><path id="math1"></path></defs><use xlink:href="#math1"></use></svg><img src="media/image.png" srcset="unsafe.png 2x" onerror="bad()"><a href="sibling#next">Sibling</a><a href="javascript:bad()">Bad</a><script>bad()</script><iframe src="https://example.com"></iframe></div><section>Comments must not be copied</section></article><aside>Graph must not be copied</aside></body></html>`;
const parser=new DOMParser() as unknown as globalThis.DOMParser;

test('Quartz-adapted extraction includes the complete article, scopes IDs and normalizes links without importing executable UI',()=>{
  const page=new URL('https://site.test/preview/folder/b');
  const {container,ids}=extractPreviewContent(article(),'b.md',page,'scope',parser);
  assert.match(container.textContent!,/End of the entire article/);assert.ok(container.textContent!.length>1600);
  assert.doesNotMatch(container.textContent!,/Comments must not|Graph must not|Navigation/);
  assert.equal(container.querySelector('script,iframe,.preview-button,[onerror],[data-preview]'),null);
  assert.ok([...container.querySelectorAll('[id]')].every(node=>node.id.startsWith('scope-')));
  assert.equal(container.querySelector('a[data-preview-anchor]')!.getAttribute('href'),'https://site.test/preview/folder/b#chapter');
  assert.equal(container.querySelector('a[data-preview-anchor]')!.getAttribute('data-preview-anchor'),ids.get('chapter'));
  assert.equal(container.querySelector('a[aria-describedby]')!.getAttribute('aria-describedby'),ids.get('fn1'));
  assert.equal(container.querySelector('use')!.getAttribute('xlink:href'),'#'+ids.get('math1'));
  assert.equal(container.querySelector('img')!.getAttribute('src'),'https://site.test/preview/folder/media/image.png');
  assert.equal(container.querySelector('img')!.hasAttribute('srcset'),false);
  assert.equal([...container.querySelectorAll('a')].find(a=>a.textContent==='Sibling')!.getAttribute('href'),'https://site.test/preview/folder/sibling#next');
  assert.equal([...container.querySelectorAll('a')].find(a=>a.textContent==='Bad')!.hasAttribute('href'),false);
  const other=extractPreviewContent(article(),'b.md',page,'second',parser);assert.notEqual(ids.get('chapter'),other.ids.get('chapter'));
  assert.throws(()=>extractPreviewContent(article(),'private.md',page,'x',parser),/requested article/);
  assert.throws(()=>extractPreviewContent('<article data-note-id="b.md">No preview marker</article>','b.md',page,'x',parser),/unavailable/);
});

test('full article previews keep unavailable-link labels and their 404 destination without importing another popout control',()=>{
  const source=article().replace('<p>Opening paragraph</p>','<p><a href="/preview/404">作者写的名称</a><a class="preview-button" href="/preview/404" aria-label="打开未找到页面"><svg></svg></a></p>');
  const {container}=extractPreviewContent(source,'b.md',new URL('https://site.test/preview/folder/b'),'missing-label',parser);
  const link=[...container.querySelectorAll('a')].find(node=>node.textContent==='作者写的名称')!;
  assert.equal(link.getAttribute('href'),'https://site.test/preview/404');
  assert.equal(link.hasAttribute('data-preview-anchor'),false);
  assert.equal(container.querySelector('.preview-button'),null);
});

test('article requests cache successful HTML, bound memory, allow retry and do not retain aborted or failed responses',async()=>{
  let count=0,fail=false,kind='text/html';
  const fetcher:typeof fetch=async(_url:Parameters<typeof fetch>[0],options?:Parameters<typeof fetch>[1])=>{
    count++;assert.equal(options?.credentials,'same-origin');assert.equal(options?.redirect,'error');
    return new Response(article(),{status:fail?404:200,headers:{'content-type':kind}});
  };
  const load=createPreviewLoader(fetcher),signal=new AbortController().signal,page=new URL('https://site.test/preview/b');
  assert.equal(count,0);await load(page,signal);await load(page,signal);assert.equal(count,1);
  await load(page,signal,true);assert.equal(count,2);
  for(let i=0;i<8;i++)await load(new URL('https://site.test/'+i),signal);
  await load(page,signal);assert.equal(count,11);
  fail=true;await assert.rejects(load(new URL('https://site.test/failure'),signal),/failed/);
  fail=false;await load(new URL('https://site.test/failure'),signal);assert.equal(count,13);
  kind='application/json';await assert.rejects(load(page,signal,true),/failed/);kind='text/html';
  const controller=new AbortController();controller.abort();await assert.rejects(load(page,controller.signal));
  const previous=count;await load(page,signal);assert.equal(count,previous+1);
});

const bundle=await build({entryPoints:['src/runtime/preview.ts'],bundle:true,write:false,format:'iife',globalName:'NotePreview',plugins:[{
  name:'preview-boundaries',setup(b){
    b.onResolve({filter:/^\.\/motion$/},()=>({path:'motion',namespace:'test'}));
    b.onResolve({filter:/^@floating-ui\/dom$/},()=>({path:'position',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='motion'
      ?'export const transition=()=>Promise.resolve(true);export const stop=()=>{};export const durations={popover:0};'
      :'export const computePosition=(...args)=>globalThis.position(...args);export const flip=()=>{};export const shift=()=>{};export const offset=()=>{};'}));
  }
}]});
function environment(load?:ReturnType<typeof createPreviewLoader>,position=async()=>({x:15,y:25})){
  const {document,window}=parseHTML(`<html><body><h2 id="chapter">Host heading</h2><span id="note-popout-1-0">Reserved-looking host ID</span><a id="trigger-b" data-preview="b.md" href="/preview/folder/b#chapter">B</a><button id="pin-b" data-open-preview="b.md">Pin B</button><a id="trigger-c" data-preview="c.md" href="/preview/c">C</a><button id="pin-c" data-open-preview="c.md">Pin C</button><a data-preview="external" href="https://other.test">External</a><div id="note-preview" hidden role="dialog"><div class="popover-top"><a id="preview-link"></a><button id="pin-preview"></button><button id="close-preview"></button></div><h2 id="preview-title"></h2><div class="popover-body" tabindex="0"><p id="preview-status"></p><button id="retry-preview" hidden>Retry</button><div id="preview-content"></div></div></div></body></html>`);
  let focused=document.body;
  Object.defineProperty(document,'activeElement',{get:()=>focused});
  window.HTMLElement.prototype.focus=function(){focused=this;};
  window.HTMLElement.prototype.getBoundingClientRect=function(){return rect(0,this.tagName==='H2'?160:20,400,300);};
  const matches=window.HTMLElement.prototype.matches;
  window.HTMLElement.prototype.matches=function(selector){return selector===':hover'?false:matches.call(this,selector);};
  const timers=new Map<number,{delay:number;fn:()=>void}>();let timerId=0;
  const calls:{url:string;signal:AbortSignal}[]=[];
  const defaultLoad:ReturnType<typeof createPreviewLoader>=async(url,signal)=>{calls.push({url:url.href,signal});return article(url.pathname.endsWith('c')?'c.md':'b.md');};
  const context={window,document,DOMParser:window.DOMParser,URL,AbortController,location:{href:'https://site.test/preview/host',origin:'https://site.test'},console,
    setTimeout(fn:()=>void,delay:number){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id:number){timers.delete(id);},
    position,fetch,
  };
  vm.runInNewContext(bundle.outputFiles[0].text,context);
  const api=(context as typeof context & {NotePreview:typeof import('../src/runtime/preview')}).NotePreview;
  const view=api.initNotePreview({records:[{slug:'b.md',title:'B',url:'/preview/folder/b'},{slug:'c.md',title:'C',url:'/preview/c'},{slug:'external',title:'External',url:'https://other.test/'}],load:load||defaultLoad});
  const get=(selector:string)=>document.querySelector<HTMLElement>(selector)!;
  const event=(target:EventTarget,type:string,values:Record<string,unknown>={})=>{
    const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,values);target.dispatchEvent(e);return e;
  };
  const runTimers=(delay:number)=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
  return {document,window,view,get,calls,event,runTimers,timers};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('fixed popout loads full text lazily, positions the chapter, scrolls footnotes locally and restores keyboard focus',async()=>{
  const e=environment();assert.equal(e.calls.length,0);
  e.event(e.get('#pin-b'),'click');await tick();
  assert.equal(e.calls[0].url,'https://site.test/preview/folder/b');
  assert.equal(e.get('#note-preview').hidden,false);assert.match(e.get('#preview-content').textContent!,/End of the entire article/);
  assert.equal(e.get('#pin-preview').getAttribute('aria-pressed'),'true');
  assert.equal(e.get('#preview-link').getAttribute('href'),'https://site.test/preview/folder/b#chapter');
  assert.equal((e.get('#preview-content details') as HTMLDetailsElement).open,true);assert.equal(e.get('.popover-body').scrollTop,128);
  assert.equal(e.get('#chapter').textContent,'Host heading');assert.equal(e.document.activeElement,e.get('#close-preview'));
  assert.equal(new Set([...e.document.querySelectorAll('[id]')].map(n=>n.id)).size,e.document.querySelectorAll('[id]').length);
  const details=e.get('#preview-content details') as HTMLDetailsElement;details.open=false;
  e.event(e.get('#preview-content a[data-preview-anchor]'),'click');assert.equal(details.open,true,'local anchor reveals closed callout');
  const footnote=e.get('#preview-content a[aria-describedby]'),event=e.event(footnote,'click');assert.equal(event.defaultPrevented,true);
  assert.equal(e.get('#note-preview').hidden,false);
  const modified=e.event(footnote,'click',{metaKey:true});assert.equal(modified.defaultPrevented,false);assert.match(footnote.getAttribute('href')!,/^https:\/\/site.test\/preview\/folder\/b#fn1$/);
  e.event(e.get('#trigger-c'),'pointerenter',{pointerType:'mouse'});e.runTimers(180);await tick();assert.equal(e.calls.length,1,'pin prevents another hover replacing the article');
  e.event(e.document,'keydown',{key:'Escape'});assert.equal(e.get('#note-preview').hidden,true);assert.equal(e.document.activeElement,e.get('#pin-b'));
  e.view.destroy();assert.equal(e.timers.size,0);
});

test('preview close and rapid replacement cancel requests and reject stale completions, while failure can retry',async()=>{
  const pending:{signal:AbortSignal;resolve:(html:string)=>void;reject:(error:Error)=>void}[]=[];
  const e=environment(async(_url,signal)=>new Promise((resolve,reject)=>pending.push({signal,resolve,reject})));
  e.event(e.get('#pin-b'),'click');await tick();assert.equal(pending.length,1);
  e.event(e.get('#pin-c'),'click');await tick();assert.equal(pending[0].signal.aborted,true);assert.equal(pending.length,2);
  pending[0].resolve(article());await tick();assert.equal(e.get('#preview-content').children.length,0);
  pending[1].reject(new Error('offline'));await tick();assert.equal(e.get('#retry-preview').hidden,false);
  e.event(e.get('#retry-preview'),'click');await tick();pending[2].resolve(article('c.md'));await tick();assert.match(e.get('#preview-content').textContent!,/End of the entire article/);
  e.event(e.get('#pin-b'),'click');await tick();e.view.hide();assert.equal(pending[3].signal.aborted,true);
  pending[3].resolve(article());await tick();assert.equal(e.get('#note-preview').hidden,true);assert.equal(e.get('#preview-content').children.length,0);
  e.view.destroy();
});

test('timeouts and invalid article content remain retryable without accepting stale or cached errors',async()=>{
  let count=0;
  const load=createPreviewLoader(async()=>new Response(article(++count===1?'wrong.md':'b.md'),{headers:{'content-type':'text/html'}}));
  const e=environment(load);e.event(e.get('#pin-b'),'click');await tick();
  assert.equal(e.get('#retry-preview').hidden,false);assert.equal(e.get('#preview-content').children.length,0);
  e.event(e.get('#retry-preview'),'click');await tick();assert.equal(count,2);assert.match(e.get('#preview-content').textContent!,/End of the entire article/);e.view.destroy();
  let finish:(html:string)=>void=()=>{};let signal:AbortSignal|undefined;
  const timed=environment(async(_url,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
  timed.event(timed.get('#pin-b'),'click');await tick();timed.runTimers(15000);assert.equal(signal!.aborted,true);
  finish(article());await tick();assert.equal(timed.get('#retry-preview').hidden,false);assert.equal(timed.get('#preview-content').children.length,0);timed.view.destroy();
});

test('lazy positioning failures stay retryable and late results cannot move a closed popout',async()=>{
  let broken=true;
  const e=environment(undefined,async()=>{if(broken)throw new Error('position unavailable');return {x:15,y:25};});
  e.event(e.get('#pin-b'),'click');await tick();
  assert.equal(e.get('#retry-preview').hidden,false);assert.match(e.get('#preview-status').textContent!,/定位失败/);
  broken=false;e.event(e.get('#retry-preview'),'click');await tick();
  assert.equal(e.get('#preview-status').hidden,true);assert.equal(e.get('#note-preview').style.left,'15px');e.view.destroy();
  const completions:((value:{x:number;y:number})=>void)[]=[];
  const late=environment(undefined,()=>new Promise(resolve=>completions.push(resolve)));
  late.event(late.get('#pin-b'),'click');await tick();assert.ok(completions.length);
  late.view.hide();for(const complete of completions)complete({x:200,y:300});await tick();
  assert.equal(late.get('#note-preview').hidden,true);assert.ok(!late.get('#note-preview').style.left);late.view.destroy();
});

test('hover is delayed, touch uses the explicit pin button, outside clicks and page exit release the preview',async()=>{
  const e=environment();e.event(e.get('#trigger-b'),'pointerenter',{pointerType:'touch'});e.runTimers(180);assert.equal(e.calls.length,0);
  e.event(e.get('#trigger-b'),'pointerenter',{pointerType:'mouse'});assert.equal(e.calls.length,0);e.runTimers(180);await tick();assert.equal(e.calls.length,1);
  e.event(e.get('#trigger-b'),'pointerleave');e.event(e.get('#note-preview'),'pointerenter');e.runTimers(180);assert.equal(e.get('#note-preview').hidden,false);
  e.event(e.document.body,'pointerdown');assert.equal(e.get('#note-preview').hidden,true);
  e.event(e.get('[data-preview="external"]'),'pointerenter',{pointerType:'mouse'});e.runTimers(180);assert.equal(e.calls.length,1);
  e.event(e.get('#pin-b'),'click');await tick();e.event(e.window,'pagehide');assert.equal(e.get('#note-preview').hidden,true);
  e.view.destroy();e.event(e.get('#pin-b'),'click');assert.equal(e.calls.length,2,'destroy removes triggers');
});
