import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';

test('reading polish keeps decorative typography and heading lines while bounding prose and code',async()=>{
  const root=postcss.parse(await readFile('src/styles/site.css','utf8'));
  const values=(selector:string)=>{const entries:string[]=[];root.walkRules(rule=>{if(rule.selectors.includes(selector))entries.push(rule.toString());});return entries.join('\n');};
  assert.match(values('.eyebrow'),/text-\[11px\]/);assert.match(values('.eyebrow'),/text-\[10px\]/);
  assert.match(values('.prose h2'),/border-bottom: 1px solid #cfd8c5/);
  assert.match(values('.prose h3 .heading-text'),/border-bottom: 1px dashed #b3c1a7/);
  assert.match(values('.prose h1 + h2'),/margin-top: 20px/);
  assert.match(values(':root'),/--prose-measure: 40em/);
  assert.match(values('.prose > :is(p, ul, ol, blockquote)'),/max-width: var\(--prose-measure\)/);
  assert.match(values('.prose pre'),/text-\[14px\]/);assert.doesNotMatch(values('.prose pre'),/text-\[(?:11|12)px\]/);
  assert.match(values('.prose pre'),/line-height: 1.95/);
  assert.match(values('.prose pre'),/rounded-\[9px\].*py-\[20px\] px-\[23px\]/);
  assert.match(values('.prose pre'),/background: #f1f2ec/);
  assert.match(values('.prose pre'),/border: 1px solid #e4e7db/);
  assert.equal(values('.wikilink'),'');
  assert.match(values('.preview-button'),/min-width: 32px/);
});

test('copy affordance floats without a toolbar or extra code frame and is revealed only by hover or focus',async()=>{
  const root=postcss.parse(await readFile('src/styles/site.css','utf8'));
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

test('outline flexibility, mobile deduplication and print hiding stay independent of visual inspection',async()=>{
  const root=postcss.parse(await readFile('src/styles/site.css','utf8'));
  let flexible=false,mobileHidden=false,printComments=false,autoSpacing=false;
  root.walkRules(rule=>{
    const declarations:Record<string,string>={};rule.walkDecls(d=>{declarations[d.prop]=d.value;});
    if(rule.selector==='.sidebar .outline-section'&&declarations.flex?.startsWith('1 1')&&declarations['min-height']==='0')flexible=true;
    if(rule.parent?.type==='atrule'&&rule.parent.name==='media'&&rule.parent.params==='(max-width: 800px)'&&rule.selector==='.sidebar .outline-section'&&declarations.display==='none')mobileHidden=true;
    if(rule.parent?.type==='atrule'&&rule.parent.params==='print'&&rule.selectors.includes('.reading-discussion')&&declarations.display==='none')printComments=true;
    if(rule.parent?.type==='atrule'&&rule.parent.name==='supports'&&rule.selector==='.prose'&&declarations['text-autospace']==='normal')autoSpacing=true;
  });
  assert.ok(flexible&&mobileHidden&&printComments&&autoSpacing);
});
