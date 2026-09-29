import {animate} from 'motion/mini';
import {frame,cancelFrame} from 'motion';
export {durations} from './timing.js';
export const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:true,addEventListener(){},removeEventListener(){}};
const controls=new Map();
function finish(element,record,completed){
  if(controls.get(element)!==record)return;
  controls.delete(element);record.native.cancel();record.restore();record.resolve(completed);
}
export function stop(element){const record=controls.get(element);if(record)finish(element,record,false);}
// Motion mini writes final keyframes inline. Restore only the properties we own,
// not cssText: CSS keeps responsive stacks, while the TOC keeps its inline target.
export function transition(element,keyframes,duration=.2){
  stop(element);if(reduced.matches)return Promise.resolve(true);
  const previous=Object.keys(keyframes).map(key=>{
    const property=key.startsWith('--')?key:key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);
    return {property,value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)};
  });
  const restore=()=>previous.forEach(({property,value,priority})=>{
    if(value)element.style.setProperty(property,value,priority);else element.style.removeProperty(property);
  });
  const native=animate(element,keyframes,{duration,ease:[.22,1,.36,1]});
  return new Promise(resolve=>{
    const record={native,restore,resolve};controls.set(element,record);
    native.then(()=>finish(element,record,true)).catch(()=>finish(element,record,false));
  });
}
reduced.addEventListener('change',()=>{if(reduced.matches)for(const element of [...controls.keys()])stop(element);});
// Motion is the only clock advancing visible force motion; D3's timer stays stopped.
export function motionLoop(step,settle,doc=document) {
  let active=false,disposed=false;
  function tick(){if(active&&step()===false)pause();}
  function pause(){active=false;cancelFrame(tick);}
  function sync(){
    cancelFrame(tick);if(!active||disposed)return;
    if(reduced.matches){active=false;settle();}
    else if(!doc.hidden)frame.update(tick,true);
  }
  reduced.addEventListener('change',sync);doc.addEventListener('visibilitychange',sync);
  return {start(){if(disposed)return;active=true;sync();},stop:pause,destroy(){disposed=true;pause();reduced.removeEventListener('change',sync);doc.removeEventListener('visibilitychange',sync);}};
}
