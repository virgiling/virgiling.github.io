import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSiteStyles} from './helpers/styles';

test('reading polish keeps decorative typography, full-column prose, and code sizing',async()=>{
  const root=await readSiteStyles();
  const values=(selector:string)=>{const entries:string[]=[];root.walkRules(rule=>{if(rule.selectors.includes(selector))entries.push(rule.toString());});return entries.join('\n');};
  assert.match(values('.eyebrow'),/text-\[11px\]/);assert.match(values('.eyebrow'),/text-\[10px\]/);
  assert.match(values('.prose h2'),/border-bottom: 1px solid #cfd8c5/);
  assert.match(values('.prose h3 .heading-text'),/border-bottom: 1px dashed #b3c1a7/);
  assert.match(values('.prose h1 + h2'),/margin-top: 20px/);
  assert.doesNotMatch(values(':root'),/--prose-measure/);
  assert.match(values(':root'),/--reading-width: 1200px/);
  assert.match(values(':root'),/--reading-gap: clamp\(44px, 4vw, 64px\)/);
  assert.match(values(':root'),/--sidebar-width: clamp\(256px, 19vw, 280px\)/);
  assert.match(values('.update-heatmap svg'),/max-w-\[280px\]/);
  assert.match(values('.graph'),/max-w-\[280px\]/);
  assert.match(values('.prose pre'),/text-\[14px\]/);assert.doesNotMatch(values('.prose pre'),/text-\[(?:11|12)px\]/);
  assert.match(values('.prose pre'),/line-height: 1.95/);
  assert.match(values('.prose pre'),/rounded-\[9px\].*py-\[20px\] px-\[23px\]/);
  assert.match(values('.prose pre'),/background: #f1f2ec/);
  assert.match(values('.prose pre'),/border: 1px solid #e4e7db/);
  assert.equal(values('.wikilink'),'');
  assert.match(values('.preview-button'),/min-width: 32px/);
});

test('copy affordance floats without a toolbar or extra code frame and is revealed only by hover or focus',async()=>{
  const root=await readSiteStyles();
  const values=(selector:string)=>{const rules:string[]=[];root.walkRules(rule=>{if(rule.selectors.includes(selector))rules.push(rule.toString());});return rules.join('\n');};
  assert.equal(values('.code-toolbar'),'');
  assert.equal(values('.code-language'),'');
  assert.match(values('.code-block'),/position: relative/);
  assert.doesNotMatch(values('.code-block'),/border|background|overflow|padding/);
  assert.doesNotMatch(values('.prose .code-block pre'),/border|background|padding/);
  assert.match(values('.copy-code'),/position: absolute/);
  assert.match(values('.copy-code'),/top: 8px/);
  assert.match(values('.copy-code'),/right: 8px/);
  assert.match(values('.copy-code'),/opacity: 0/);
  assert.match(values('.copy-code'),/pointer-events: none/);
  for(const selector of ['.code-block:hover .copy-code','.code-block:focus-within .copy-code']){
    assert.match(values(selector),/opacity: 1/);
    assert.match(values(selector),/pointer-events: auto/);
  }
});

test('sidebar scrolls as one bounded rail, mobile deduplicates the outline and print hides comments',async()=>{
  const root=await readSiteStyles();
  let railScrolls=false,outlineInFlow=false,mobileHidden=false,printComments=false,autoSpacing=false;
  root.walkRules(rule=>{
    const declarations:Record<string,string>={};rule.walkDecls(d=>{declarations[d.prop]=d.value;});
    const applied:string[]=[];rule.walkAtRules('apply',a=>{applied.push(a.params);});
    if(rule.selector==='.sidebar'&&applied.join(' ').includes('overflow-y-auto')&&declarations['max-height']?.includes('dvh')&&declarations.height===undefined)railScrolls=true;
    if(rule.selectors.includes('.sidebar .toc-scroll')&&declarations['max-height']==='none'&&declarations.overflow==='visible')outlineInFlow=true;
    if(rule.parent?.type==='atrule'&&rule.parent.name==='media'&&rule.parent.params==='(max-width: 960px)'&&rule.selector==='.sidebar .outline-section'&&declarations.display==='none')mobileHidden=true;
    if(rule.parent?.type==='atrule'&&rule.parent.params==='print'&&rule.selectors.includes('.reading-discussion')&&declarations.display==='none')printComments=true;
    if(rule.parent?.type==='atrule'&&rule.parent.name==='supports'&&rule.selector==='.prose'&&declarations['text-autospace']==='normal')autoSpacing=true;
  });
  assert.ok(railScrolls&&outlineInFlow&&mobileHidden&&printComments&&autoSpacing);
});
