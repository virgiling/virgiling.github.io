import {transition,stop,durations} from './motion.js';
export function initStacks(){
  const stacks=[...document.querySelectorAll('.card-stack:not(.single)')];
  if(!stacks.length)return;
  const hover=matchMedia('(any-hover: hover)');let input='keyboard';
  function setStack(group,open){
    if(group.classList.contains('is-open')===open)return;
    const root=group.closest('.folder-frame');
    const neighbors=[...document.querySelectorAll('.folder-frame')].filter(x=>x!==root);
    const branches=[...root.querySelectorAll('.folder-subframe')].filter(x=>!x.contains(group));
    neighbors.push(...branches.filter(x=>!branches.some(parent=>parent!==x&&parent.contains(x))));
    const elements=[...group.querySelectorAll('.stack-card'),...neighbors.filter(x=>{const r=x.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight+250;})];
    elements.forEach(stop);const before=new Map(elements.map(e=>[e,e.getBoundingClientRect()]));
    const count=group.querySelector('button.stack-count');
    // Never leave focus on a card that is about to become inert.
    if(!open&&[...group.querySelectorAll('.stack-card')].slice(1).some(card=>card.contains(document.activeElement)))count.focus({preventScroll:true});
    group.classList.toggle('is-open',open);
    count.setAttribute('aria-expanded',String(open));count.setAttribute('aria-label',`${group.dataset.folder}：${count.textContent}，${open?'收起':'展开'}`);
    [...group.querySelectorAll('.stack-card')].forEach((card,i)=>{card.inert=!open&&i>0;card.setAttribute('aria-hidden',String(!open&&i>0));});
    const after=elements.map(e=>({e,rect:e.getBoundingClientRect(),transform:getComputedStyle(e).transform}));
    for(const {e,rect,transform} of after){
      const first=before.get(e);if(!first.width||!rect.width)continue;
      const dx=first.left-rect.left,dy=first.top-rect.top,sx=first.width/rect.width,sy=first.height/rect.height;
      if(Math.abs(dx)+Math.abs(dy)+Math.abs(1-sx)+Math.abs(1-sy)<.5)continue;
      transition(e,{transform:[`translate(${dx}px,${dy}px) scale(${sx},${sy}) ${transform==='none'?'':transform}`,transform]},durations.stack);
    }
  }
  const controls=stacks.map(group=>{
    const count=group.querySelector('button.stack-count');
    let hovered=false,keyboardFocus=false,pinned=false,dismissed=false,movingFocus=false;
    const update=()=>setStack(group,!dismissed&&(hovered||keyboardFocus||pinned));
    function dismiss(restoreFocus=false){
      hovered=false;keyboardFocus=false;pinned=false;dismissed=true;movingFocus=true;
      if(restoreFocus)count.focus({preventScroll:true});
      update();movingFocus=false;
    }
    group.addEventListener('pointerenter',event=>{if(hover.matches&&['mouse','pen'].includes(event.pointerType)){hovered=true;pinned=false;dismissed=false;update();}});
    group.addEventListener('pointerleave',event=>{if(event.pointerType==='touch')return;hovered=false;pinned=false;update();});
    group.addEventListener('focusin',()=>{if(!movingFocus&&input==='keyboard'){keyboardFocus=true;dismissed=false;update();}});
    group.addEventListener('focusout',event=>{if(!group.contains(event.relatedTarget)){keyboardFocus=false;pinned=false;update();}});
    count.addEventListener('click',()=>{
      if(hovered&&input==='pointer')return; // Mouse already controls this through hover.
      if(group.classList.contains('is-open'))dismiss();else{dismissed=false;pinned=true;update();}
    });
    group.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dismiss(true);}});
    count.disabled=false;group.classList.add('stack-ready');
    count.setAttribute('aria-expanded','false');count.setAttribute('aria-label',`${group.dataset.folder}：${count.textContent}，展开`);
    [...group.querySelectorAll('.stack-card')].forEach((card,i)=>{card.inert=i>0;card.setAttribute('aria-hidden',String(i>0));});
    return {group,dismiss,clearKeyboard:()=>{keyboardFocus=false;},reveal:()=>{pinned=true;dismissed=false;update();}};
  });
  document.addEventListener('keydown',()=>{input='keyboard';},true);
  document.addEventListener('pointerdown',event=>{
    input='pointer';for(const control of controls){control.clearKeyboard();if(!control.group.contains(event.target))control.dismiss();}
  },true);
  hover.addEventListener('change',()=>{for(const control of controls)control.dismiss();});
  function revealHash(){
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const control=controls.find(c=>c.group.id===id);
    if(control){control.reveal();control.group.scrollIntoView({block:'start'});}
  }
  if(location.hash)revealHash();addEventListener('hashchange',revealHash);
}
