import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { initCodeCopy } from '../src/runtime/code-copy';
import { headerScrollState, initScrollHeader, shortcutLabel } from '../src/runtime/scroll-header';
import { rect } from './helpers/dom';

function globals(values: Record<string, unknown>) {
  const old=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  return ()=>{for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}};
}
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test('copy tools copy code only, recover from failure, enhance previews and cancel stale results on destroy',async()=>{
  const {document,window}=parseHTML('<html><body><div class="code-block"><pre tabindex="0"><code>let x = 1;\n</code></pre></div><div id="preview-content"></div></body></html>');
  const restore=globals({Element:window.Element,MutationObserver:window.MutationObserver});
  let reject=false;
  const copied:string[]=[];
  const pre=document.querySelector('pre')!.outerHTML;
  const controller=initCodeCopy(document,{async writeText(value){if(reject)throw new Error('denied');copied.push(value);}});
  try{
    const button=document.querySelector<HTMLButtonElement>('.copy-code')!;
    assert.equal(button.parentElement?.className,'code-block');
    assert.equal(document.querySelector('pre')!.outerHTML,pre,'The control must not change or enter the scrolling pre');
    assert.equal(button.querySelector('svg')!.getAttribute('aria-hidden'),'true');
    assert.equal(button.querySelector('.sr-only')!.textContent,'复制');
    assert.equal(button.type,'button');
    const icon=button.querySelector('path')!,idlePath=icon.getAttribute('d');
    icon.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();
    assert.deepEqual(copied,['let x = 1;\n']);assert.equal(button.textContent,'已复制');
    assert.notEqual(icon.getAttribute('d'),idlePath);
    assert.equal(button.getAttribute('aria-label'),'代码已复制');
    reject=true;button.click();await tick();assert.match(button.textContent,/复制失败/);
    assert.match(button.title,/请手动选择代码/);
    document.querySelector('#preview-content')!.innerHTML='<div class="code-block"><pre><code>preview</code></pre></div>';
    await tick();assert.equal(document.querySelectorAll('.copy-code').length,2);
    reject=false;document.querySelector<HTMLButtonElement>('#preview-content .copy-code')!.click();await tick();
    assert.deepEqual(copied,['let x = 1;\n','preview']);
    assert.equal(document.querySelectorAll('.copy-code').length,2,'Feedback must not cause duplicate controls');
    controller.destroy();assert.equal(document.querySelectorAll('.copy-code').length,0);
    let finish:()=>void=()=>{};
    const late=initCodeCopy(document,{writeText:()=>new Promise<void>(resolve=>{finish=resolve;})});
    const lateButton=document.querySelector<HTMLButtonElement>('.copy-code')!;
    lateButton.click();late.destroy();finish();await tick();assert.equal(lateButton.textContent,'复制');
    const again=initCodeCopy(document,undefined);
    const unavailable=document.querySelector<HTMLButtonElement>('.copy-code')!;
    unavailable.click();await tick();assert.match(unavailable.textContent,/复制失败/);
    again.destroy();
    assert.equal(document.querySelectorAll('.copy-code').length,0);
  }finally{controller.destroy();restore();}
});

test('header direction threshold rejects jitter and reveals on upward movement, focus and page top',()=>{
  let state={y:100,travel:0,visible:true};
  state=headerScrollState(state,104,80);assert.equal(state.visible,true);
  state=headerScrollState(state,110,80);assert.equal(state.visible,true);
  state=headerScrollState(state,120,80);assert.equal(state.visible,false);
  state=headerScrollState(state,115,80);assert.equal(state.visible,false);
  state=headerScrollState(state,107,80);assert.equal(state.visible,true);
  assert.equal(headerScrollState({...state,visible:false},200,80,true).visible,true);
  assert.equal(headerScrollState({...state,visible:false},0,80).visible,true);
  assert.equal(shortcutLabel('Macintosh'),'⌘ K');
  assert.equal(shortcutLabel('iPhone'),'⌘ K');
  assert.equal(shortcutLabel('Windows NT 10.0'),'Ctrl K');
  assert.equal(shortcutLabel('Linux'),'Ctrl K');
});

test('scroll header owns listeners, height, focus visibility and cleanup across reinitialization',()=>{
  const {document,window}=parseHTML('<html><body><header class="topbar"><a href="/">Home</a></header></body></html>');
  const header=document.querySelector<HTMLElement>('.topbar')!;
  header.getBoundingClientRect=()=>rect(0,0,500,90);
  Object.defineProperty(document.documentElement,'scrollHeight',{value:3000});
  let active:Element|null=null;
  Object.defineProperty(document,'activeElement',{get:()=>active});
  const events=new EventTarget(),frames=new Map<number,FrameRequestCallback>();let sequence=0;
  const restore=globals({document,scrollY:0,innerHeight:600,getComputedStyle:()=>({transform:'none'}),
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:(id:number)=>frames.delete(id)});
  const scroll=(y:number)=>{Reflect.set(globalThis,'scrollY',y);events.dispatchEvent(new Event('scroll'));const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(0));};
  try{
    const controller=initScrollHeader();
    assert.equal(document.documentElement.style.getPropertyValue('--topbar-height'),'90px');
    scroll(300);assert.ok(header.classList.contains('is-away'));
    scroll(285);assert.ok(!header.classList.contains('is-away'));
    scroll(400);assert.ok(header.classList.contains('is-away'));
    active=header.querySelector('a');header.dispatchEvent(new window.Event('focusin'));
    assert.ok(!header.classList.contains('is-away'));scroll(500);assert.ok(!header.classList.contains('is-away'));
    active=null;events.dispatchEvent(new Event('scroll'));assert.equal(frames.size,1);
    controller.destroy();assert.equal(frames.size,0);assert.ok(!header.hasAttribute('data-scroll-header'));
    assert.ok(!document.documentElement.style.getPropertyValue('--topbar-height'));
    scroll(600);assert.ok(!header.classList.contains('is-away'));
    const again=initScrollHeader();scroll(800);assert.ok(header.classList.contains('is-away'));again.destroy();
  }finally{restore();}
});
