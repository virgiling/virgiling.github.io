import {transition,stop,durations} from './motion.js';
import {loadGraphAssets} from './graph-assets.js';
export function initGraph({beforeOpen=()=>{},load=loadGraphAssets}={}){
  const dialog=document.querySelector('#graph-dialog'),trigger=document.querySelector('#open-graph');
  if(!dialog||!trigger)return {close:()=>{}};
  const viewport=document.querySelector('#graph-viewport'),status=document.querySelector('#graph-status'),retry=document.querySelector('#retry-graph');
  let opener,restoreFocus=true,view,request=0;
  async function render(){
    const ticket=++request;status.hidden=false;status.textContent='正在加载全局图谱…';retry.hidden=true;
    try{
      const {data,mount}=await load();
      if(ticket!==request||!dialog.open)return;
      view=mount(viewport,data,{current:dialog.dataset.current});status.hidden=true;
    }catch{
      if(ticket!==request||!dialog.open)return;
      status.textContent='图谱加载失败，请重试。';retry.hidden=false;
    }
  }
  function close(options={}){restoreFocus=options.restoreFocus!==false;if(dialog.open)dialog.close();}
  trigger.hidden=false;
  // Warm only on explicit pointer/keyboard intent, not every page's first paint.
  const warm=()=>{void load().catch(()=>{});};
  trigger.addEventListener('pointerenter',warm);trigger.addEventListener('focus',warm);
  trigger.addEventListener('pointerdown',warm);
  trigger.addEventListener('click',()=>{
    if(dialog.open)return;
    opener=document.activeElement;restoreFocus=true;beforeOpen();dialog.showModal();
    transition(dialog,{opacity:[0,1],transform:['translateY(8px) scale(.97)','none']},durations.spotlightIn);
    void render();
  });
  retry.addEventListener('click',()=>{void render();});
  document.querySelector('#close-graph').addEventListener('click',()=>close());
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{++request;view?.destroy();view=undefined;viewport.replaceChildren();stop(dialog);if(restoreFocus&&opener?.isConnected)opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  });
  return {close};
}
