import assert from 'node:assert/strict';
import postcss,{type AnyNode} from 'postcss';

/** Inspect actual Vite/Tailwind output, not a mock of the source stylesheet. */
export function verifyStyles(css:string){
  const root=postcss.parse(css);
  root.walkAtRules(rule=>assert.ok(!['apply','theme','source'].includes(rule.name),`Uncompiled Tailwind directive: ${rule.name}`));
  root.walkAtRules(rule=>assert.ok(!/keyframes$/i.test(rule.name),'UI keyframes must not bypass Motion'));
  root.walkDecls(d=>{
    if(/^(animation|transition)(-|$)/.test(d.prop))assert.ok(['none','0s','0ms'].includes(d.value),'Timed CSS must not bypass Motion');
    if(d.prop==='scroll-behavior')assert.notEqual(d.value,'smooth','Native smooth scrolling must not bypass Motion');
  });
  const entries:{selector:string;media:string;declarations:Record<string,string>}[]=[];
  root.walkRules(rule=>{
    let media='';for(let p:AnyNode|undefined=rule.parent;p;p=p.parent)if(p.type==='atrule'&&p.name==='media')media+=p.params;
    const declarations:Record<string,string>={};rule.walkDecls(d=>{declarations[d.prop]=d.value+(d.important?'!important':'');});
    for(const selector of rule.selectors)entries.push({selector,media,declarations});
  });
  function has(selector:string,expected:Record<string,string>,media=''){
    const found=entries.some(e=>e.selector===selector&&(media?e.media.includes(media):!e.media)&&Object.entries(expected).every(([k,v])=>e.declarations[k]===v));
    assert.ok(found,`Compiled CSS contract missing: ${selector} ${media} ${JSON.stringify(expected)}`);
  }
  has('[hidden]',{display:'none!important'});
  has('.sr-only',{position:'absolute',width:'1px',height:'1px',overflow:'hidden','clip-path':'inset(50%)'});
  has('.header-inner',{display:'flex','min-height':'92px'});
  has('.page-intro h1',{'font-size':'42px'});
  has('.article-header>h1',{'font-size':'32px'});
  has('.article-header>h1',{'font-size':'28px'},'560');
  has('.prose h1',{'font-size':'30px'});
  has('.prose h1',{'font-size':'26px'},'560');
  assert.ok(!entries.some(e=>/^\.article h1(?::|$)/.test(e.selector)),'Page-title styles must not match every prose h1');
  has('.friends-section h1',{'font-size':'24px'});
  has('.friend-posts li',{display:'grid','grid-template-columns':'minmax(0,1fr) auto','padding-block':'8px'});
  has('.friend-post-summary',{display:'flex','min-width':'0'});
  has('.friend-post-author',{'max-width':'28%','text-overflow':'ellipsis','white-space':'nowrap'});
  has('.friend-post-title',{'font-size':'15px','text-overflow':'ellipsis','white-space':'nowrap'});
  has('.friend-post-date',{'white-space':'nowrap'});
  has('.article-layout',{display:'grid'});
  has('.article-layout',{display:'block'},'800');
  has('.reading-meta',{'font-family':'var(--hand)','font-size':'18px'});
  has('.reading-meta',{'font-size':'17px'},'560');
  has('.prose',{'font-size':'var(--reading-font-size)','line-height':'1.95'});
  has('.prose img',{'max-width':'100%','height':'auto','object-fit':'contain'});
  has('.prose img[data-image-sized]',{'width':'auto','max-width':'min(100%, var(--image-width,100%))','max-height':'var(--image-height,none)'});
  has('.medium-zoom-image--hidden',{'visibility':'hidden'});
  has('.medium-zoom-image--opened',{'z-index':'61'});
  has('.image-zoom-close',{'width':'44px','height':'44px'});
  has('.comments-entry',{display:'flex','flex-direction':'column','align-items':'stretch'});
  has('.giscus-host',{width:'100%'});
  has('.folder-heading-link',{display:'inline-flex',color:'var(--accent)'});
  has('.folder-heading-name',{'text-decoration-line':'underline'});
  has('.folder-link-hint',{display:'inline-flex','font-size':'13px'});
  assert.ok(entries.some(e=>e.selector==='.folder-heading-link.is-emphasized .folder-link-arrow'&&['translateX(3px)','translate(3px)'].includes(e.declarations.transform)),'MoC arrow state must remain after CSS minification');
  has('.toc-scroll',{'overscroll-behavior':'contain'});
  has('.graph svg[data-local-graph]',{'touch-action':'none',cursor:'default'});
  has('.graph-local a[data-node-id]',{cursor:'grab'});
  has('.graph-local a.is-dragging',{cursor:'grabbing'});
  has('.graph-local .graph-node-label',{opacity:'var(--graph-label-opacity,0)','pointer-events':'none'});
  has('.graph-local a[aria-current] .graph-node-label',{opacity:'1'});
  assert.ok(!entries.some(e=>e.selector.includes('comments-link')),'Removed comments link styles returned');
  assert.ok(entries.some(e=>e.selector.includes(':focus-visible')&&e.declarations.outline==='2px solid var(--accent)'),'Visible keyboard focus must remain');
}
