import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {initImageZoom} from '../src/runtime/image-zoom.js';
const bundle=await build({entryPoints:['src/runtime/image-zoom-view.js'],bundle:true,write:false,format:'iife',globalName:'ZoomView',plugins:[{name:'motion-boundary',setup(b){b.onResolve({filter:/^\.\/motion\.js$/},()=>({path:'motion',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const transition=(...args)=>globalThis.motion(...args); export const stop=node=>globalThis.stopMotion(node);'}));}}]});
function environment({hold=false,hd=false}={}) {
  const {document,window}=parseHTML(`<html><body><header>navigation</header><main><a data-image-zoom href="https://s2.loli.net/full.png"><img src="https://s2.loli.net/full.png" alt="截图" ${hd?'data-zoom-src="https://s2.loli.net/full.png" data-zoom-width="2940" data-zoom-height="1846"':''}></a></main></body></html>`);
  Object.defineProperties(document.documentElement,{clientWidth:{value:1280},clientHeight:{value:800}});
  let focused=document.body;Object.defineProperty(document,'activeElement',{get:()=>focused});
  window.HTMLElement.prototype.focus=function(){focused=this;};
  window.HTMLElement.prototype.getBoundingClientRect=function(){return {top:80,left:40,width:400,height:251,right:440,bottom:331};};
  Object.defineProperties(window.HTMLImageElement.prototype,{naturalWidth:{configurable:true,get:()=>905},naturalHeight:{configurable:true,get:()=>568},complete:{configurable:true,get:()=>true}});
  const calls=[],pending=new Map();
  const motion=(node,frames)=>{calls.push({node,frames});return hold?new Promise(resolve=>pending.set(node,resolve)):Promise.resolve(true);};
  const flush=()=>{for(const resolve of pending.values())resolve(true);pending.clear();};
  const context={window,document,NodeList:window.NodeList,CustomEvent:window.CustomEvent,console,setTimeout,clearTimeout,Promise,motion,stopMotion(node){pending.get(node)?.(false);pending.delete(node);}};
  vm.runInNewContext(bundle.outputFiles[0].text,context);
  return {window,document,calls,pending,flush,view:context.ZoomView.mountImageZoom(document),image:document.querySelector('img'),link:document.querySelector('a')};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('actual medium-zoom uses Motion for geometry/overlay, supplies modal keyboard exit, restores focus and survives HD failure',async()=>{
  const e=environment({hd:true});e.link.focus();await e.view.open(e.image);
  const overlay=e.document.querySelector('[role="dialog"]');assert.ok(overlay);assert.equal(overlay.getAttribute('aria-modal'),'true');assert.ok(e.document.querySelector('main').inert);
  assert.equal(e.calls.length,2);assert.match(e.calls[0].frames.transform[1],/^scale\(/);assert.equal(e.document.activeElement.getAttribute('aria-label'),'关闭图片预览');
  // HD is not required to open. Linkedom deliberately performs no network/image decode.
  assert.equal(e.document.querySelectorAll('.medium-zoom-image--opened').length,1);
  const key=new e.window.Event('keydown',{bubbles:true,cancelable:true});key.key='Escape';e.document.dispatchEvent(key);await tick();
  assert.equal(e.document.querySelector('[role="dialog"]'),null);assert.equal(e.document.activeElement,e.link);assert.ok(!e.document.querySelector('main').inert);assert.ok(!e.image.classList.contains('medium-zoom-image--hidden'));
  await e.view.open(e.image);await e.view.close();await e.view.destroy();assert.equal(e.document.querySelectorAll('.image-zoom-close').length,0);
});

test('original OSS images zoom using browser natural dimensions without generated variants or HD metadata',async()=>{
  const e=environment();await e.view.open(e.image);
  assert.equal(e.image.getAttribute('data-zoom-src'),null);
  const opened=e.document.querySelector('.medium-zoom-image--opened');assert.ok(opened);
  assert.equal(opened.getAttribute('src'),'https://s2.loli.net/full.png');
  assert.match(e.calls[0].frames.transform[1],/^scale\(/);
  await e.view.close();await e.view.destroy();
});

test('close during Motion entrance is queued, destroy cancels active effects and does not leave an inert page',async()=>{
  const e=environment({hold:true});const opened=e.view.open(e.image),closed=e.view.close();assert.equal(e.pending.size,2);e.flush();await tick();assert.equal(e.pending.size,2);e.flush();await Promise.all([opened,closed]);
  const reopening=e.view.open(e.image);await e.view.destroy();await reopening;assert.equal(e.pending.size,0);assert.equal(e.document.querySelector('[role="dialog"]'),null);assert.ok(!e.document.querySelector('main').inert);assert.equal(e.document.querySelectorAll('.medium-zoom-image').length,0);
});

test('intent loads one shared module; modified links stay native and failed imports fall back to original',async()=>{
  const {document,window}=parseHTML('<main><a data-image-zoom href="https://s2.loli.net/full.png"><img></a></main>');
  const image=document.querySelector('img');Object.defineProperties(image,{complete:{value:true},naturalWidth:{value:100}});
  let loads=0,opens=0,destroys=0;const navigations=[];
  const control=initImageZoom({root:document,load:async()=>{loads++;return {mountImageZoom:()=>({open:async()=>{opens++;},destroy:()=>{destroys++;}})};},navigate:url=>navigations.push(url)});
  const event=(type,extra={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extra);image.dispatchEvent(e);return e;};
  event('pointerover');event('focusin');const modified=event('click',{ctrlKey:true});assert.equal(modified.defaultPrevented,false);await tick();assert.equal(opens,0);
  const normal=event('click');assert.ok(normal.defaultPrevented);await tick();assert.equal(loads,1);assert.equal(opens,1);control.destroy();assert.equal(destroys,1);
  const failed=initImageZoom({root:document,load:async()=>{throw new Error('offline');},navigate:url=>navigations.push(url)});event('click');await tick();assert.deepEqual(navigations,['https://s2.loli.net/full.png']);failed.destroy();
});
