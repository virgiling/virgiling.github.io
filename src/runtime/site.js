import {transition,stop,durations} from './motion.js';
import {computePosition,flip,shift,offset} from '@floating-ui/dom';
import {initStacks} from './stacks.js';
import {initSearch} from './search.js';
import {initOnThisPage} from './toc.js';
import {initGraph} from './graph.js';
import {initLocalGraphs} from './local-graph.js';
import {initInteractionMotion} from './interactions.js';
import {initImageZoom} from './image-zoom.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const prefix=document.body.dataset.root||'';
initStacks();initInteractionMotion();const toc=initOnThisPage();
let imageZoom=initImageZoom(),localGraphs=initLocalGraphs();
addEventListener('pagehide',()=>{imageZoom.destroy();localGraphs.destroy();});
addEventListener('pageshow',event=>{if(event.persisted){imageZoom=initImageZoom();localGraphs=initLocalGraphs();}});

const pop=$('#note-preview'),previewRecords=JSON.parse($('#preview-data')?.textContent||'[]');
let anchor,pinned=false,showTimer,hideTimer;
async function positionPreview(){
  if(!anchor||pop.hidden)return;const current=anchor;
  const {x,y}=await computePosition(current,pop,{strategy:'fixed',placement:'bottom-start',middleware:[offset(10),flip(),shift({padding:14})]});
  if(anchor===current&&!pop.hidden){pop.style.left=`${x}px`;pop.style.top=`${y}px`;}
}
function pin(value){pinned=value;$('#pin-preview').setAttribute('aria-pressed',String(value));$('#pin-preview').textContent=value?'取消固定':'固定';}
function showPreview(target,key,explicit=false){
  if(target.closest('[data-local-graph].is-node-dragging'))return;
  const n=previewRecords.find(r=>r.slug===key);if(!n||(pinned&&!explicit))return;
  clearTimeout(showTimer);clearTimeout(hideTimer);anchor=target;
  $('#preview-title').textContent=n.title;$('#preview-text').textContent=n.summary;$('#preview-kind').textContent=n.tags.join(' / ');
  $('#preview-link').href=target.getAttribute('href')||n.url;
  const wasHidden=pop.hidden;pop.hidden=false;pin(explicit);positionPreview();if(wasHidden)transition(pop,{opacity:[0,1]},durations.popover);
  if(explicit)$('#close-preview').focus({preventScroll:true});
}
function hidePreview(restore=false){const previous=anchor;clearTimeout(showTimer);clearTimeout(hideTimer);stop(pop);pop.hidden=true;pin(false);anchor=undefined;if(restore&&previous){previous.focus({preventScroll:true});clearTimeout(showTimer);}}
function scheduleHide(){clearTimeout(showTimer);clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!pinned&&!pop.matches(':hover')&&!pop.contains(document.activeElement))hidePreview();},180);}
$$('[data-preview]').forEach(link=>{
  link.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;clearTimeout(hideTimer);clearTimeout(showTimer);showTimer=setTimeout(()=>showPreview(link,link.dataset.preview),180);});
  link.addEventListener('pointerleave',scheduleHide);link.addEventListener('focus',()=>{clearTimeout(showTimer);showTimer=setTimeout(()=>showPreview(link,link.dataset.preview),180);});link.addEventListener('blur',scheduleHide);link.addEventListener('click',()=>hidePreview());
});
$$('[data-open-preview]').forEach(b=>b.addEventListener('click',()=>showPreview(b,b.dataset.openPreview,true)));
pop.addEventListener('pointerenter',()=>clearTimeout(hideTimer));pop.addEventListener('pointerleave',scheduleHide);pop.addEventListener('focusout',scheduleHide);
$('#pin-preview').addEventListener('click',()=>pin(!pinned));$('#close-preview').addEventListener('click',()=>hidePreview(true));$('#preview-link').addEventListener('click',()=>hidePreview());
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-local-graph]')){hidePreview();return;}if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('[data-preview],[data-open-preview]'))hidePreview();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){e.preventDefault();hidePreview(true);}});

const outline=$('#outline-dialog');
const graph=initGraph({beforeOpen:()=>{hidePreview();if(outline?.open)outline.close();}});
initSearch({prefix,beforeOpen:()=>{hidePreview();graph.close({restoreFocus:false});if(outline?.open)outline.close();}});
if(outline){
  $('#open-outline').addEventListener('click',()=>{hidePreview();graph.close({restoreFocus:false});outline.showModal();toc.update();transition(outline,{opacity:[0,1]},durations.popover);});
  $('#close-outline').addEventListener('click',()=>outline.close());$$('#outline-dialog a').forEach(a=>a.addEventListener('click',()=>outline.close()));outline.addEventListener('close',()=>stop(outline));
  outline.addEventListener('click',e=>{if(e.target===outline){const r=outline.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)outline.close();}});
}
let ticking=false;const progress=$('.reading-progress');
function onScroll(){if(progress){const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;}if(!pop.hidden)positionPreview();}
addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false;});ticking=true;}},{passive:true});addEventListener('resize',positionPreview);onScroll();
