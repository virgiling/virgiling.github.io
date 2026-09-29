import {importSearch} from '../search';
let load:Promise<ReturnType<typeof importSearch>>|undefined;
self.onmessage=async(event:MessageEvent<{id:number;url:string;query:string}>)=>{
  const {id,url,query}=event.data;
  try{
    load??=fetch(url).then(r=>{if(!r.ok)throw new Error('Search unavailable');return r.json();}).then(importSearch).catch(error=>{load=undefined;throw error;});
    const search=await load;self.postMessage({id,records:search(query)});
  }catch{self.postMessage({id,error:'搜索暂时不可用，请重试。'});}
};
