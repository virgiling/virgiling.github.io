import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {imageSize} from 'image-size';
import {siteConfig} from '../src/site.config';
import {verifyStyles} from './styles-contract';
import {validateGraph} from '../src/runtime/graph-view';
import {hasBiro,biroPath,biroURL,legacyBiroBytes} from '../src/fonts';
const root=resolve('dist'),base=siteConfig.base,files:string[]=[];
async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else files.push(relative(root,path));}}
await walk(root);const all=new Set(files),html=new Map<string,{ids:Set<string>;links:{value:string;kind:string}[]}>();
// Follow static JS imports as well as entry tags; shared Motion chunks are not free.
const moduleGraph=await build({entryPoints:files.filter(f=>f.endsWith('.js')).map(f=>resolve(root,f)),bundle:true,write:false,metafile:true,outdir:'/tmp/notes-verify-unused',logLevel:'silent'});
const jsImports=new Map(Object.entries(moduleGraph.metafile!.inputs).map(([path,input])=>[resolve(path),input.imports.filter(i=>!i.external&&i.kind==='import-statement').map(i=>resolve(i.path))]));
let publicGraph:any;
const localGraphs:{file:string;ids:Set<string>;current:string}[]=[];
const usedHan=new Set<number>();
const archiveEntries=new Set<string>(),archiveMocs:{source:string;href:string;root:string}[]=[];
const commentTitles=new Map<string,string>();
const attributes=(node:any)=>Object.fromEntries((node.attrs||[]).map((a:{name:string;value:string})=>[a.name,a.value]));
const errors:string[]=[],stats={pages:0,localLinks:0,initialJsGzipMax:0,cssGzip:0,fontBytes:0,searchGzip:0,graphGzip:0,archiveMocLinks:0};
function output(path:string){
  if(!path.startsWith(base))return undefined;let local=decodeURIComponent(path.slice(base.length));
  if(!local)return 'index.html';
  if(local.endsWith('/'))return all.has(local+'index.html')?local+'index.html':undefined;
  return [local,local+'.html',local+'/index.html'].find(f=>all.has(f));
}
for(const file of files){
  assert.ok(!/(^|\/)(?:content|private|\.git|\.obsidian|\.claudian)(?:\/|$)/.test(file),`Forbidden output path ${file}`);
  assert.ok(!/\.(?:md|base|canvas|bib|csl|map|ttf|otf)$/i.test(file),`Forbidden raw source ${file}`);
  const buffer=await readFile(resolve(root,file));
  if(file.endsWith('.css'))stats.cssGzip+=gzipSync(buffer).length;
  if(file.endsWith('.woff2'))stats.fontBytes+=buffer.length;
  assert.ok(!/^_astro\/.*\.(?:png|jpe?g|gif|webp|avif)$/i.test(file),`Unexpected generated image: ${file}`);
  if(file.startsWith('data/search-'))stats.searchGzip+=gzipSync(buffer).length;
  if(file.startsWith('data/graph-')){
    stats.graphGzip+=gzipSync(buffer).length;
    const graph=validateGraph(JSON.parse(buffer.toString()));publicGraph=graph;
    for(const node of graph.nodes)if(!output(node.url))errors.push(`${file}: missing graph route ${node.url}`);
  }
  if(!/\.(?:html|json|js|css|xml)$/.test(file))continue;
  const source=buffer.toString();assert.ok(!source.includes('/Users/'),'Absolute local path leaked');assert.ok(!source.includes('sourceMappingURL=data:'),'Inline sourcemap');
  if(!file.endsWith('.html'))continue;
  const doc=parse(source),ids=new Set<string>(),links:{value:string;kind:string}[]=[],scripts:string[]=[];let inlineJs='',favicons=0,friendTitles=0;
  let pageTitle='',hasComments=false;const ogTitles:string[]=[];
  const friendPage=file==='link.html'&&source.includes('id="friend-circle"');
  function visit(node:any,skipFontText=false){
    skipFontText ||= ['script','style','pre','code','kbd','samp'].includes(node.tagName);
    if(node.nodeName==='#text'&&!skipFontText)for(const char of node.value)if(/\p{Script=Han}/u.test(char))usedHan.add(char.codePointAt(0)!);
    const attrs=attributes(node),classes=(attrs.class||'').split(/\s+/);
    if(node.tagName==='title'&&node.parentNode?.tagName==='head')pageTitle=node.childNodes.map((child:{value?:string})=>child.value||'').join('');
    if(node.tagName==='meta'&&attrs.property==='og:title')ogTitles.push(attrs.content);
    if(friendPage){
      if(classes.includes('article-header'))errors.push(`${file}: redundant article header on friend page`);
      if(node.tagName==='h1'){
        friendTitles++;
        if(attrs.id!=='page-title'||node.childNodes.map((child:any)=>child.value||'').join('')!=='近况')errors.push(`${file}: expected only the recent-activity heading`);
      }
    }
    if(file==='articles.html'){
      const source=attrs['data-note']||attrs['data-directory-moc'];
      if(source){if(archiveEntries.has(source))errors.push(`${file}: duplicate archive representation ${source}`);archiveEntries.add(source);}
      if('data-directory-moc' in attrs){
        let parent=node.parentNode,folder='';
        while(parent){const a=attributes(parent);if('data-folder-root' in a){folder=a['data-folder-root'];break;}parent=parent.parentNode;}
        if(node.tagName!=='a'||node.parentNode?.parentNode?.tagName!=='h2'||!folder)errors.push(`${file}: MoC must be a native top-level heading link`);
        archiveMocs.push({source:attrs['data-directory-moc'],href:attrs.href,root:folder});
      }
    }
    if(classes.includes('comments-link'))errors.push(`${file}: removed Discussions link returned`);
    if(classes.some((c:string)=>['graph-local-controls','local-graph-help','graph-node-list','graph-hint','graph-fallback'].includes(c)))errors.push(`${file}: removed graph lists/controls/help`);
    if(node.tagName==='img'){
      if('data-image-optimized' in attrs||attrs.srcset||attrs.sizes)errors.push(`${file}: image must use its original URL, not generated variants`);
      if(attrs.src?.startsWith(base+'_astro/'))errors.push(`${file}: image was rewritten to an Astro asset`);
      if(/\|\d+(?:x\d+)?$/.test(attrs.alt||''))errors.push(`${file}: unresolved OFM image dimensions`);
    }
    if(node.tagName==='link'&&attrs.rel==='modulepreload'&&attrs.href)scripts.push(attrs.href);
    if(node.tagName==='link'&&attrs.rel==='icon'){
      favicons++;
      if(attrs.href!==base+'favicon.png'||attrs.type!=='image/png')errors.push(`${file}: favicon must use the base-aware original PNG`);
    }
    const discussion=new URL('/'+(file==='index.html'?'':file.replace(/index\.html$/,'').replace(/\.html$/,'')),siteConfig.site).href;
    if('data-comments' in attrs){hasComments=true;const config=JSON.parse(attrs['data-config']);if(config.enabled!==true||'term' in config)errors.push(`${file}: comments must use the Open Graph title, not a custom URL term`);}
    if(attrs.name==='giscus:backlink'&&attrs.content!==discussion)errors.push(`${file}: comments backlink points to a preview URL`);
    if(classes.includes('comments-status')&&(!('hidden' in attrs)||(node.childNodes||[]).some((n:any)=>n.value?.trim())))errors.push(`${file}: comments show placeholder engineering text`);
    if('data-local-graph' in attrs){
      const ids=new Set<string>(),current:string[]=[],box=attrs.viewBox.split(/\s+/).map(Number);
      function graphNode(n:any){
        const a=attributes(n);
        if(a['data-node-id']){if(ids.has(a['data-node-id']))errors.push(`${file}: duplicate local node`);ids.add(a['data-node-id']);if(a['aria-current']==='page')current.push(a['data-node-id']);}
        if((a.class||'').split(/\s+/).includes('current-node')&&(Number(a.cx)!==box[0]+box[2]/2||Number(a.cy)!==box[1]+box[3]/2))errors.push(`${file}: current note is not centred`);
        n.childNodes?.forEach(graphNode);
      }
      graphNode(node);if(current.length!==1)errors.push(`${file}: local graph must have one current note`);
      localGraphs.push({file,ids,current:current[0]});
    }
    if(node.tagName==='html'&&('data-biro' in attrs)!==hasBiro())errors.push(`${file}: font availability mismatch`);
    if(attrs.id){if(ids.has(attrs.id))errors.push(`${file}: duplicate id ${attrs.id}`);ids.add(attrs.id);}
    if(node.tagName==='script'){
      if(attrs.src)scripts.push(attrs.src);
      else if(attrs.type!=='application/json')inlineJs+=(node.childNodes||[]).map((n:{value?:string})=>n.value||'').join('');
    }
    for(const attr of ['href','src','data-search-index','data-graph-index'])if(attrs[attr]&&!['canonical','alternate'].includes(attrs.rel)&&!attrs[attr].startsWith('data:'))links.push({value:attrs[attr],kind:attr});
    for(const attr of Object.keys(attrs))if(attr.startsWith('on'))errors.push(`${file}: inline event handler`);
    if(node.tagName==='iframe')errors.push(`${file}: unsolicited iframe`);
    node.childNodes?.forEach((child:any)=>visit(child,skipFontText));
  }
  visit(doc);html.set(file,{ids,links});stats.pages++;
  const suffix=' · '+siteConfig.brand.name,title=pageTitle.endsWith(suffix)?pageTitle.slice(0,-suffix.length):pageTitle;
  if(ogTitles.length!==1||!title||ogTitles[0]!==title)errors.push(`${file}: Open Graph title must equal the page title without site branding or filename suffixes`);
  if(hasComments){
    const previous=commentTitles.get(ogTitles[0]);
    if(previous)errors.push(`${file}: duplicate comment title ${JSON.stringify(ogTitles[0])} also used by ${previous}`);
    else commentTitles.set(ogTitles[0],file);
  }
  if(favicons!==1)errors.push(`${file}: expected one favicon link`);
  if(friendPage&&friendTitles!==1)errors.push(`${file}: expected exactly one recent-activity h1`);
  let scriptSize=inlineJs?gzipSync(inlineJs).length:0;
  const initial=new Set<string>();
  function include(path:string){if(initial.has(path))return;initial.add(path);for(const child of jsImports.get(path)||[])include(child);}
  for(const script of scripts){assert.ok(!/^https?:/.test(script),'No unsolicited remote scripts');const target=output(script);if(target)include(resolve(root,target));}
  for(const path of initial)scriptSize+=gzipSync(await readFile(path)).length;
  stats.initialJsGzipMax=Math.max(stats.initialJsGzipMax,scriptSize);
}
const archiveExpected=new Set<string>(publicGraph.nodes.filter((n:any)=>n.type==='page'&&!['page:index.md','page:about.md'].includes(n.id)).map((n:any)=>n.id.slice(5)));
if(archiveExpected.size!==archiveEntries.size||[...archiveExpected].some(source=>!archiveEntries.has(source)))errors.push('Archive must represent every discoverable non-landing page exactly once, as a card or MoC heading');
for(const moc of archiveMocs){
  const page=publicGraph.nodes.find((n:any)=>n.id==='page:'+moc.source);
  const key=(s:string)=>s.replace(/^\d+[-_ ]+/,'').normalize('NFC').toLowerCase();
  if(!page||page.url!==moc.href||key(moc.source.split('/').at(-1)!.replace(/-toc\.md$/i,''))!==key(moc.root))errors.push(`Invalid archive MoC mapping for ${moc.root}`);
}
stats.archiveMocLinks=archiveMocs.length;
for(const local of localGraphs){
  // An unlisted current page is deliberately absent from discovery data; that
  // branch is covered with synthetic fixtures, not a fabricated public node.
  if(!publicGraph?.nodes.some((n:any)=>n.id===local.current))continue;
  const expected=new Set([local.current]);
  for(const edge of publicGraph.edges){if(edge.from===local.current)expected.add(edge.to);if(edge.to===local.current)expected.add(edge.from);}
  if(expected.size!==local.ids.size||[...expected].some(id=>!local.ids.has(id)))errors.push(`${local.file}: local graph is not the strict one-hop neighbourhood`);
}
for(const [file,page] of html){
  const pageURL=new URL(base+(file==='index.html'?'':file.replace(/index\.html$/,'').replace(/\.html$/,'')),'https://local.invalid');
  for(const {value} of page.links){
    let parsed:URL;try{parsed=new URL(value,pageURL);}catch{errors.push(`${file}: malformed URL`);continue;}
    if(parsed.origin!=='https://local.invalid')continue;
    const target=output(parsed.pathname);stats.localLinks++;
    if(!target){errors.push(`${file}: missing target ${value}`);continue;}
    if(parsed.hash&&html.has(target)){
      let id:string;try{id=decodeURIComponent(parsed.hash.slice(1));}catch{continue;}
      if(id&&!html.get(target)!.ids.has(id))errors.push(`${file}: missing fragment ${value}`);
    }
  }
}
const favicon=await readFile(resolve(root,'favicon.png'));
assert.deepEqual(favicon,await readFile('public/favicon.png'),'Build must preserve the original favicon bytes');
const icon=imageSize(favicon);assert.equal(icon.type,'png');assert.equal(icon.width,32);assert.equal(icon.height,32);
if(hasBiro()){
  const font=output(biroURL(base));assert.ok(font,'Local build must include the supplied Biro font');
  assert.deepEqual(await readFile(resolve(root,font)),await readFile(biroPath()),'Build must preserve the supplied font bytes');
}
verifyStyles((await Promise.all(files.filter(f=>f.endsWith('.css')).map(f=>readFile(resolve(root,f),'utf8')))).join('\n'));
// CSS public-font URLs must also honor a non-root base.
for(const file of files.filter(f=>f.endsWith('.css'))){const text=await readFile(resolve(root,file),'utf8');for(const match of text.matchAll(/url\(["']?([^\s)"']+)/g)){if(match[1].startsWith('data:'))continue;const target=new URL(match[1],'https://local.invalid'+base+file);if(!output(target.pathname))errors.push(`${file}: missing CSS resource ${match[1]}`);}}
assert.ok(stats.initialJsGzipMax<=20*1024,`Initial JS exceeds budget: ${stats.initialJsGzipMax}`);
assert.ok(stats.cssGzip<=12*1024,`CSS exceeds budget: ${stats.cssGzip}`);
// The author's explicit original-Biro choice is accounted separately, not
// hidden. Complete coverage is now a sharded archive, not the old three files;
// enforce separate UI, per-shard and total archive budgets below.
const biroBytes=hasBiro()?(await readFile(biroPath())).length:0;
assert.ok(biroBytes<=legacyBiroBytes,`Biro exceeds its recorded source size: ${biroBytes}`);
const fontManifest=JSON.parse(await readFile('src/fonts/generated/manifest.json','utf8'));
const generatedFonts=fontManifest.fonts.flatMap((font:any)=>font.files);
const hanCoverage=new Set(fontManifest.fonts.find((font:any)=>font.id==='notes-cjk').files.flatMap((file:any)=>file.codepoints));
const unsupportedHan=[...usedHan].filter(cp=>!hanCoverage.has(cp)).map(cp=>'U+'+cp.toString(16).toUpperCase());
Object.assign(stats,{hanCodepoints:usedHan.size,unsupportedHan});
if(unsupportedHan.length)console.warn(`[fonts] Source font lacks ${unsupportedHan.length} rendered Han codepoints; system fallback remains necessary.`);
const uiFontBytes=generatedFonts.filter((font:any)=>font.ui).reduce((sum:number,font:any)=>sum+font.bytes,0);
assert.ok(uiFontBytes<=256*1024,`UI font subsets exceed budget: ${uiFontBytes}`);
assert.ok(generatedFonts.every((font:any)=>font.bytes<=128*1024),'A font shard exceeds 128 KiB');
assert.ok(stats.fontBytes-biroBytes<=8*1024*1024,'Complete OFL font archive exceeds 8 MiB; not a first-page download budget');
assert.equal(stats.fontBytes-biroBytes,generatedFonts.reduce((sum:number,font:any)=>sum+font.bytes,0),'Only current generated OFL fonts may be emitted');
const emittedFontHashes=new Set(await Promise.all(files.filter(f=>f.endsWith('.woff2')).map(async file=>createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'))));
for(const font of generatedFonts)assert.ok(emittedFontHashes.has(font.sha256),`Missing or modified emitted font ${font.file}`);
Object.assign(stats,{uiFontBytes,fontShardBytesMax:Math.max(...generatedFonts.map((font:any)=>font.bytes))});
await mkdir('.astro/reports',{recursive:true});
await writeFile(`.astro/reports/astro-${base==='/'?'root':'base'}.json`,JSON.stringify({base,stats,errors},null,2));
if(errors.length){console.error(errors.slice(0,80).join('\n'));throw new Error(`${errors.length} static verification errors`);}
console.log(JSON.stringify({base,...stats,status:'passed'},null,2));
