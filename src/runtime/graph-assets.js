let pending,resource;
export function loadGraphAssets(){
  const url=document.body.dataset.graphIndex;
  if(pending&&resource===url)return pending;
  resource=url;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  const data=fetch(url,{signal:controller.signal,credentials:'same-origin'})
    .then(response=>{if(!response.ok)throw new Error('Graph unavailable');return response.json();})
    .finally(()=>clearTimeout(timer));
  const task=Promise.all([data,import('./graph-view.js')])
    .then(([data,module])=>({data,mount:module.mountGraph}))
    .catch(error=>{if(pending===task)pending=undefined;throw error;});
  pending=task;return task;
}
