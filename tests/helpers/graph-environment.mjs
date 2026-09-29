// Node boundary doubles only: no browser, DOM implementation or pixel rendering.
import {runInNewContext} from 'node:vm';
export function graphEnvironment(code,{canvas=true,reducedMotion=false}={}){
  const calls=[],frames=new Map();let count=0,disconnected=0,time=0;
  const ctx=Object.fromEntries(['setTransform','clearRect','translate','scale','beginPath','setLineDash','moveTo','lineTo','stroke','arc','fill','fillText'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  class Element extends EventTarget{
    constructor(tag){super();this.tagName=tag;this.clientWidth=900;this.clientHeight=500;this.clientLeft=this.clientTop=0;this.children=[];this.attrs={};this.style={setProperty:()=>{},removeProperty:()=>{}};this.ownerDocument=doc;}
    append(...nodes){this.children.push(...nodes);nodes.forEach(n=>n.parentNode=this);}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    remove(){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
    setAttribute(key,value){this.attrs[key]=value;}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:500};}
    getContext(){return canvas?ctx:null;}
    click(){this.dispatchEvent(new Event('click'));}
  }
  const doc=Object.assign(new EventTarget(),{hidden:false,createElement:tag=>new Element(tag),fonts:{ready:Promise.resolve()},documentElement:{style:{MozUserSelect:'text'}}});
  const view=new EventTarget();view.document=doc;doc.defaultView=view;
  const media=new EventTarget();media.matches=reducedMotion;
  const context={console,document:doc,navigator:{maxTouchPoints:0},devicePixelRatio:4,performance:{now:()=>time},matchMedia:()=>media,getComputedStyle:()=>({fontFamily:'serif'}),requestAnimationFrame:fn=>{frames.set(++count,fn);return count;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){disconnected++;}},setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask};
  runInNewContext(code,context);
  return {viewer:context.Viewer,host:new Element('div'),calls,frames,view,doc,media,get disconnected(){return disconnected;},paint(){time+=1000/60;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));}};
}
