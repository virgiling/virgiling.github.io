import {calloutHTML,calloutText} from '../markdown/callouts.mjs';
const DAY=86400000;
function timestamp(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const ms=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?ms:null;
}
// Build-time deterministic with an explicit asOf date; no automatic remote checks.
export function freshnessStatus(note,config,asOf){
  if(!config?.enabled||note.stale===false)return null;
  const today=timestamp(asOf);if(today===null)throw new Error('Invalid freshness evaluation date');
  if(note.reviewAfter){
    const due=timestamp(note.reviewAfter);if(due===null)throw new Error('Invalid reviewAfter');
    return today>due?{kind:'review',date:note.reviewAfter,days:Math.floor((today-due)/DAY)}:null;
  }
  if(!note.stale&&note.staleAfter==null&&!config.checkPaths.some(path=>note.source?.startsWith(path)))return null;
  const threshold=note.staleAfter??config.staleThreshold;
  if(!Number.isInteger(threshold)||threshold<0)throw new Error('Invalid staleAfter threshold');
  const date=note.reviewed||note.updated||note.date;if(!date)return null;
  const updated=timestamp(date);if(updated===null)throw new Error('Invalid freshness reference date');
  const days=Math.floor((today-updated)/DAY);
  return days>threshold?{kind:'stale',date,days,threshold}:null;
}
export function FreshnessNotice(note,config,asOf){
  const status=freshnessStatus(note,config,asOf);if(!status)return '';
  const text=status.kind==='review'?`本文的计划复核日期为 ${status.date}，现已逾期 ${status.days} 天，请确认内容仍然有效。`:`本文最后复核或更新于 ${status.date}，距今已超过 ${status.threshold} 天，内容可能已经过时。`;
  return calloutHTML({type:'warning',title:[calloutText('时效性提示')],classes:['freshness-notice'],ariaLabel:'时效性提示',body:[{type:'element',tagName:'p',properties:{},children:[calloutText(text)]}]});
}
