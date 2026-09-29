import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
// Author-supplied original webfont, preserved without subsetting or conversion.
export const biroPath=()=>resolve('assets/fonts/biro-script-plus.woff2');
export const hasBiro=()=>existsSync(biroPath());
export const biroURL=(base:string)=>`${base}fonts/biro-script-plus.woff2`;
export const biroStyles=(base:string)=>`@font-face{font-family:"Biro Script Plus";src:url("${biroURL(base)}") format("woff2");font-display:swap;font-weight:400}html[data-biro]{--hand:"Biro Script Plus","Notes Latin",cursive}`;
export const legacyBiroBytes=284772;
