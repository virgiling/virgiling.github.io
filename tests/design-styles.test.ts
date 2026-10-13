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
  assert.match(values('.prose pre'),/line-height: 1.7/);
  assert.equal(values('.wikilink'),'');
  assert.match(values('.preview-button'),/min-width: 32px/);
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
