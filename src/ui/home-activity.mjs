import {esc} from './shared.mjs';
const DAY=86400000;
const iso=timestamp=>new Date(timestamp).toISOString().slice(0,10);
// Input is the publication-filtered page catalog, never raw Vault contents.
// One last-known update per article is not a complete editing/commit history.
export function articleActivity(pages,{recentCount=1,heatmapWeeks=26}={}){
  if(!Number.isInteger(recentCount)||recentCount<0||!Number.isInteger(heatmapWeeks)||heatmapWeeks<1||heatmapWeeks>53)throw new Error('Invalid home activity configuration');
  const articles=[...new Map(pages.filter(n=>n.kind==='article'&&n.publish!==false&&!n.unlisted).map(n=>[n.slug,n])).values()].map(n=>{
    const day=n.updated||n.date;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||iso(Date.parse(day+'T00:00:00Z'))!==day)throw new Error(`Invalid article activity date: ${n.slug}`);
    return {...n,activityDate:day};
  }).sort((a,b)=>b.activityDate.localeCompare(a.activityDate)||a.slug.localeCompare(b.slug,'en'));
  if(!articles.length)return {recent:[],days:[],counts:[],weeks:heatmapWeeks,start:null,end:null};
  const end=articles[0].activityDate,last=Date.parse(end+'T00:00:00Z');
  const start=last-new Date(last).getUTCDay()*DAY-(heatmapWeeks-1)*7*DAY;
  const counts=new Map();
  for(const n of articles)counts.set(n.activityDate,(counts.get(n.activityDate)||0)+1);
  const days=Array.from({length:heatmapWeeks*7},(_,i)=>{
    const day=iso(start+i*DAY),count=counts.get(day)||0;
    return {date:day,count,level:Math.min(count,4),future:day>end};
  });
  return {recent:articles.slice(0,recentCount),days,counts:days.filter(d=>d.count&&!d.future),weeks:heatmapWeeks,start:iso(start),end};
}
export function HomeActivity(pages,config,p=''){
  const activity=articleActivity(pages,config);
  const recent=activity.recent.length?`<ol class="recent-updates">${activity.recent.map(n=>`<li><a href="${esc(p+n.url)}">${esc(n.title)}</a><time datetime="${n.activityDate}">${n.activityDate}</time></li>`).join('')}</ol>`:'<p class="side-empty">暂无文章更新。</p>';
  const heatmap=activity.days.length?`<div class="update-heatmap"><p class="heatmap-range"><time datetime="${activity.start}">${activity.start}</time> — <time datetime="${activity.end}">${activity.end}</time></p><svg viewBox="0 0 ${activity.weeks*10} 70" role="img" aria-labelledby="heatmap-title heatmap-description"><title id="heatmap-title">文章最近更新日分布，${activity.weeks} 周</title><desc id="heatmap-description">${activity.counts.map(d=>`${d.date}：${d.count} 篇`).join('；')}。每篇文章只按最近更新日计一次，不代表完整编辑历史。</desc>${activity.days.map((d,i)=>`<rect class="heatmap-day level-${d.level}${d.future?' is-future':''}" x="${Math.floor(i/7)*10}" y="${i%7*10}" width="8" height="8" rx="2" data-date="${d.date}" data-count="${d.count}"><title>${d.future?'':`${d.date}：${d.count} 篇`}</title></rect>`).join('')}</svg></div>`:'';
  return `<section class="side-section home-activity" aria-labelledby="updates-heading"><h2 class="side-title" id="updates-heading">最近更新</h2>${recent}${heatmap}</section>`;
}
