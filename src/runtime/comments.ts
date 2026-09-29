export function commentAllowed(origin:string,enabled=true) {
  try {return enabled&&['http:','https:'].includes(new URL(origin).protocol);} catch {return false;}
}
export function giscusAttributes(config:{repo:string;repoId:string;category:string;categoryId:string;term:string}) {
  return {'data-repo':config.repo,'data-repo-id':config.repoId,'data-category':config.category,'data-category-id':config.categoryId,
    'data-mapping':'specific','data-term':config.term,'data-strict':'1','data-reactions-enabled':'1','data-input-position':'bottom','data-theme':'light','data-lang':'zh-CN','data-loading':'lazy','crossorigin':'anonymous'};
}
export function initComments() {
  const section=document.querySelector<HTMLElement>('[data-comments]');if(!section)return;
  const config=JSON.parse(section.dataset.config!),status=section.querySelector<HTMLElement>('.comments-status')!,host=section.querySelector<HTMLElement>('.giscus-host')!,retry=section.querySelector<HTMLButtonElement>('.comments-retry')!;
  if(!commentAllowed(location.origin,config.enabled))return;
  let state='idle',attempt=0,timer:ReturnType<typeof setTimeout>;
  const ready=()=>{clearTimeout(timer);state='loaded';retry.hidden=true;status.textContent='';status.hidden=true;};
  const fail=()=>{state='failed';status.hidden=false;status.textContent='评论暂时不可用，请稍后重试。';retry.hidden=false;};
  const load=()=>{
    if(state==='loading'||state==='loaded')return;state='loading';retry.hidden=true;host.replaceChildren();status.hidden=false;status.textContent='正在加载 GitHub 评论…';
    const revision=++attempt,script=document.createElement('script');script.src='https://giscus.app/client.js';script.async=true;
    for(const [key,value] of Object.entries(giscusAttributes(config)))script.setAttribute(key,value);
    const failed=()=>{if(attempt===revision){clearTimeout(timer);fail();}};
    script.onerror=failed;clearTimeout(timer);timer=setTimeout(failed,15000);host.append(script);
  };
  window.addEventListener('message',event=>{
    const frame=host.querySelector('iframe');
    if(event.origin!=='https://giscus.app'||!frame||event.source!==frame.contentWindow||!event.data?.giscus)return;
    // A page without a discussion is a valid empty giscus UI, not a failed
    // connection. Only a visitor's deliberate comment/reaction creates it.
    if(event.data.giscus.error==='Discussion not found')ready();
    else if(event.data.giscus.error){clearTimeout(timer);fail();}
    else if(event.data.giscus.resizeHeight)ready();
  });
  retry.addEventListener('click',load);
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'200px'});observer.observe(section);}
  else {status.hidden=false;status.textContent='点击下方按钮加载评论。';retry.hidden=false;}
}
