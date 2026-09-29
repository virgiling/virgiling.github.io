import {url} from '../site.config.ts';
export const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export const folderId=path=>'folder-'+(path?Buffer.from(path).toString('hex'):'root');
export const folderFrameId=path=>'frame-'+folderId(path);
export const tagURL=(tag)=>url(`tags/${Buffer.from(tag).toString('hex')}`);
export const headingLink=(id,text)=>`<a class="heading-anchor" href="#${encodeURIComponent(id)}" aria-label="链接到 ${esc(text)}">#</a>`;
export const searchIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>`;
