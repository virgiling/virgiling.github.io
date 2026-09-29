// Small intent loader. No lightbox engine or full-resolution image on first paint.
export function initImageZoom({root=document,load=()=>import('./image-zoom-view.js'),navigate=url=>location.assign(url)}={}) {
  if(!root.querySelector('a[data-image-zoom]'))return {destroy:()=>{}};
  let pending,view,disposed=false,ticket=0;
  const prepare=()=>pending||(pending=load().catch(error=>{pending=undefined;throw error;}));
  const anchor=event=>event.target?.closest?.('a[data-image-zoom]');
  const warm=event=>{if(anchor(event))void prepare().catch(()=>{});};
  async function click(event) {
    const link=anchor(event);
    if(!link||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();const current=++ticket;
    try {
      const module=await prepare();if(disposed||current!==ticket)return;
      const image=link.querySelector('img');if(!image)return;
      if(!image.complete||!image.naturalWidth)await image.decode();
      if(disposed||current!==ticket)return;
      view??=module.mountImageZoom(root);await view.open(image);
    }catch{if(!disposed&&current===ticket)navigate(link.href);}
  }
  root.addEventListener('pointerover',warm);root.addEventListener('focusin',warm);root.addEventListener('pointerdown',warm);root.addEventListener('click',click);
  const destroy=()=>{disposed=true;ticket++;root.removeEventListener('pointerover',warm);root.removeEventListener('focusin',warm);root.removeEventListener('pointerdown',warm);root.removeEventListener('click',click);void view?.destroy();};
  return {destroy};
}
