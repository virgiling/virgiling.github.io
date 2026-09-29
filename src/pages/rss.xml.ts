import {getSnapshot} from '../content/snapshot';
import {canonical,siteConfig} from '../site.config';
import {esc} from '../ui/shared.mjs';
export async function GET(){
  const {listed}=await getSnapshot();
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(siteConfig.brand.name)}</title><link>${esc(canonical())}</link><description>${esc(siteConfig.brand.motto)}</description>${listed.filter(n=>n.kind==='article').map(n=>`<item><title>${esc(n.title)}</title><link>${esc(canonical(n.route))}</link><guid>${esc(canonical(n.route))}</guid><description>${esc(n.summary)}</description>${n.date?`<pubDate>${new Date(n.date+'T00:00:00Z').toUTCString()}</pubDate>`:''}</item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml'}});
}
