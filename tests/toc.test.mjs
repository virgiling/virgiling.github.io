import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const bundle=await build({entryPoints:['src/runtime/toc.js'],bundle:true,write:false,format:'iife',globalName:'TOC'});
function environment(specs,{tocTop=100,outerHeight=600,clipHeight=90}={}){
  const frames=[],win=new EventTarget(),prose=new EventTarget(),document=new EventTarget();
  const media=new EventTarget();media.matches=true;
  const context={console,matchMedia:()=>media,scrollY:0,innerHeight:600,location:{hash:''},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},addEventListener:win.addEventListener.bind(win),getComputedStyle:n=>({transform:n.style.transform})};
  const headings=specs.map(({id,top,visible=true,tag='H1'})=>({id,tagName:tag,top,visible,getClientRects(){return this.visible?[{}]:[];},getBoundingClientRect(){return {top:this.top-context.scrollY};},closest:()=>null}));
  function nav(){
    const outer={scrollTop:0,clientTop:0,clientHeight:outerHeight,scrollHeight:Math.max(outerHeight,tocTop+clipHeight+100),getBoundingClientRect:()=>({top:0})};
    const scroller={scrollTop:0,clientTop:0,clientHeight:clipHeight,scrollHeight:headings.length*30,getBoundingClientRect:()=>({top:tocTop-outer.scrollTop})};
    const links=headings.map((h,i)=>({dataset:{heading:h.id},attrs:new Map(),classes:new Set(),offsetHeight:28,getBoundingClientRect(){const top=tocTop-outer.scrollTop+i*30-scroller.scrollTop;return {top,bottom:top+28,height:28};},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},classList:{toggle(k,on){on?links[i].classes.add(k):links[i].classes.delete(k);}}}));
    const marker={hidden:true,style:{height:'',transform:''}},track={getBoundingClientRect:()=>({top:tocTop-outer.scrollTop-scroller.scrollTop})};
    return {links,marker,scroller,outer,visible:true,contains:n=>links.includes(n),closest:s=>s==='.sidebar'?outer:null,querySelectorAll:()=>links,querySelector:s=>s==='.toc-marker'?marker:s==='.toc-scroll'?scroller:track,getBoundingClientRect(){return {width:this.visible?260:0};}};
  }
  const navs=[nav(),nav()];
  // Deliberately expose no selector-based heading list: the controller must use
  // the generated TOC IDs, not guess an H2/H3 subset of the page DOM.
  prose.querySelectorAll=()=>[];prose.contains=h=>headings.includes(h);
  document.querySelector=()=>prose;document.querySelectorAll=()=>navs;document.getElementById=id=>headings.find(h=>h.id===id);document.documentElement={scrollHeight:3000};document.fonts={ready:Promise.resolve()};context.document=document;
  runInNewContext(bundle.outputFiles[0].text,context);const controller=context.TOC.initOnThisPage();
  const selected=()=>navs.map(n=>n.links.find(a=>a.attrs.get('aria-current')==='location')?.dataset.heading);
  return {headings,navs,prose,selected,controller,document,scroll(y){context.scrollY=y;win.dispatchEvent(new Event('scroll'));frames.splice(0).forEach(fn=>fn());},resize(){win.dispatchEvent(new Event('resize'));}};
}
test('page-bottom heading is automatically visible inside a long clipped TOC, with reverse follow',()=>{
  const e=environment(Array.from({length:20},(_,i)=>({id:i===19?'致谢':`part-${i}`,top:300+i*120})));
  e.scroll(2400);assert.deepEqual(e.selected(),['致谢','致谢']);
  for(const nav of e.navs){const r=nav.links[19].getBoundingClientRect(),s=nav.scroller;assert.ok(r.top>=s.getBoundingClientRect().top);assert.ok(r.bottom<=s.getBoundingClientRect().top+s.clientHeight,'active 致谢 must not need a second manual scroll');}
  e.scroll(0);assert.equal(e.navs[0].scroller.scrollTop,0);
});
test('a clipped outer sidebar also follows, but initial homepage activity stays in view',()=>{
  const e=environment([{id:'start',top:300},{id:'thanks',top:2900}],{tocTop:300,outerHeight:220});
  assert.equal(e.navs[0].outer.scrollTop,0,'do not hide home activity on initial load');
  e.scroll(2400);assert.ok(e.navs[0].links[1].getBoundingClientRect().bottom<=220);
});
test('do not move a hidden outline or fight keyboard browsing; opening it resynchronizes',()=>{
  const e=environment(Array.from({length:20},(_,i)=>({id:`p${i}`,top:300+i*120})));
  e.navs[1].visible=false;e.document.activeElement=e.navs[0].links[0];e.scroll(2400);
  assert.equal(e.navs[0].scroller.scrollTop,0);assert.equal(e.navs[1].scroller.scrollTop,0);
  e.document.activeElement=null;e.navs[1].visible=true;e.controller.update();
  assert.ok(e.navs.every(n=>n.scroller.scrollTop>0));
});
test('about-style H1-only TOC advances and moves back with scroll in both outlines',()=>{
  const e=environment([{id:'about-me',top:300},{id:'publication',top:800},{id:'project',top:1300}]);
  assert.deepEqual(e.selected(),['about-me','about-me']);assert.equal(e.navs[0].marker.style.transform,'translateY(0px)');
  e.scroll(700);assert.deepEqual(e.selected(),['publication','publication']);assert.equal(e.navs[0].marker.style.transform,'translateY(30px)');assert.ok(e.navs[0].links[0].classes.has('is-read'));
  e.scroll(1250);assert.deepEqual(e.selected(),['project','project']);e.scroll(0);assert.deepEqual(e.selected(),['about-me','about-me']);assert.ok(!e.navs[0].links[1].classes.has('is-read'));
});
test('mixed H1/H2 dotfiles TOC starts at 概述, not the first H2 需求',()=>{
  const e=environment([{id:'概述',top:300},{id:'为什么选择这套工具',top:650},{id:'需求',top:900,tag:'H2'},{id:'如何使用',top:1300}]);
  assert.deepEqual(e.selected(),['概述','概述']);e.scroll(560);assert.deepEqual(e.selected(),['为什么选择这套工具','为什么选择这套工具']);e.scroll(800);assert.deepEqual(e.selected(),['需求','需求']);
});
test('top-of-page selects first visible heading, collapsed headings are skipped, bottom clamps',()=>{
  const e=environment([{id:'first',top:10},{id:'short',top:40},{id:'folded',top:70,visible:false},{id:'last',top:2900}]);
  assert.deepEqual(e.selected(),['first','first']);e.scroll(60);assert.deepEqual(e.selected(),['short','short']);e.scroll(2400);assert.deepEqual(e.selected(),['last','last']);
  e.headings[3].visible=false;e.prose.dispatchEvent(new Event('toggle'));assert.deepEqual(e.selected(),['short','short']);
});
