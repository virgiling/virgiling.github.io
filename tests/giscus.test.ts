import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initComments} from '../src/runtime/comments';

test('giscus mounts once near the viewport, retries failures and authenticates messages',t=>{
  const status={textContent:'',hidden:true},retry=new EventTarget() as EventTarget&{hidden:boolean};retry.hidden=true;
  const frame={contentWindow:{}},scripts:any[]=[];let observerCallback:(e:{isIntersecting:boolean}[])=>void=()=>{},timer:(()=>void)|undefined;
  const host={replaceChildren(){scripts.length=0;},append(script:any){scripts.push(script);},querySelector(){return frame;}};
  const section={dataset:{config:JSON.stringify({repo:'owner/site',repoId:'repo',category:'Notes',categoryId:'category',enabled:true})},querySelector(selector:string){return selector==='.giscus-host'?host:selector==='.comments-status'?status:retry;}};
  const window=new EventTarget() as EventTarget&{IntersectionObserver:boolean};window.IntersectionObserver=true;
  const globals={document:{querySelector:()=>section,createElement:()=>({attrs:{},setAttribute(k:string,v:string){this.attrs[k]=v;}})},location:{origin:'http://localhost:4321'},window,
    IntersectionObserver:class {constructor(cb:typeof observerCallback){observerCallback=cb;}observe(){}disconnect(){}},
    setTimeout:(cb:()=>void)=>{timer=cb;return 1;},clearTimeout:()=>{timer=undefined;},
  };
  for(const [key,value] of Object.entries(globals)){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete (globalThis as any)[key];});
  }
  initComments();assert.equal(scripts.length,0);assert.equal(status.hidden,true);observerCallback([{isIntersecting:true}]);assert.equal(scripts.length,1);assert.equal(status.hidden,false);
  const script=scripts[0];assert.equal(script.src,'https://giscus.app/client.js');assert.equal(script.attrs['data-theme'],'light');assert.equal(script.attrs['data-mapping'],'og:title');assert.equal(script.attrs['data-strict'],'1');assert.equal('data-term' in script.attrs,false);
  observerCallback([{isIntersecting:true}]);assert.equal(scripts[0],script);
  timer!();assert.equal(retry.hidden,false);retry.dispatchEvent(new Event('click'));assert.equal(scripts.length,1);assert.notEqual(scripts[0],script);
  function message(origin:string,source:unknown,data:unknown){const event=new Event('message');Object.assign(event,{origin,source,data});window.dispatchEvent(event);}
  message('https://evil.example',frame.contentWindow,{giscus:{resizeHeight:100}});assert.notEqual(status.textContent,'');
  message('https://giscus.app',{}, {giscus:{resizeHeight:100}});assert.notEqual(status.textContent,'');
  message('https://giscus.app',frame.contentWindow,{giscus:{resizeHeight:100}});assert.equal(status.textContent,'');assert.equal(retry.hidden,true);
  assert.equal(timer,undefined);assert.equal(status.hidden,true);
  script.onerror();assert.equal(status.hidden,true,'an old attempt cannot overwrite successful retry state');
  message('https://giscus.app',frame.contentWindow,{giscus:{error:'Discussion not found'}});assert.equal(status.hidden,true);assert.equal(retry.hidden,true,'no discussion yet is not a network failure');
});

test('disabled comments stay quiet and do not create remote scripts or loading observers',t=>{
  const status={textContent:'',hidden:true},retry={hidden:true};
  const section={dataset:{config:JSON.stringify({enabled:false})},querySelector:(selector:string)=>selector==='.comments-status'?status:selector==='.comments-retry'?retry:{}};
  for(const [key,value] of Object.entries({document:{querySelector:()=>section,createElement:()=>assert.fail('disabled comments must not load a script')},location:{origin:'http://localhost:4321'}})){
    const original=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete (globalThis as any)[key];});
  }
  initComments();assert.equal(status.textContent,'');assert.equal(status.hidden,true);assert.equal(retry.hidden,true);
});
