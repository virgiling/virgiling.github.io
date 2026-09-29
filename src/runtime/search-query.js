const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('zh-CN');
export function prepareRecord(record){
  return {...record,searchText:normalize(`${record.title} ${(record.tags||[]).join(' ')} ${record.summary||''} ${record.text||''}`),searchTags:(record.tags||[]).map(tag=>normalize(tag).replace(/^#+/,''))};
}
export function parseQuery(value){
  const text=[],tags=[];
  for(const token of normalize(value).trim().split(/\s+/).filter(Boolean)){
    if(token.startsWith('#')){const tag=token.slice(1).replace(/\/+$/,'');if(tag)tags.push(tag);}
    else text.push(token);
  }
  return {text,tags};
}
function hasTag(tag,query){
  // Full paths/root descendants, or a complete path segment such as #Obsidian.
  return tag===query||tag.startsWith(query+'/')||(!query.includes('/')&&tag.split('/').includes(query));
}
export function searchRecords(records,value){
  const query=parseQuery(value);
  return records.filter(record=>query.tags.every(tag=>record.searchTags.some(actual=>hasTag(actual,tag)))&&query.text.every(term=>record.searchText.includes(term)));
}
