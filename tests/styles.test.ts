import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import postcss from 'postcss';
import {verifyStyles} from '../scripts/styles-contract';

test('Tailwind scans only renderer sources, with no automatic Vault scan or Preflight reset',async()=>{
  const css=await readFile('src/styles/site.css','utf8'),root=postcss.parse(css),sources:string[]=[],imports:string[]=[];
  root.walkAtRules('source',r=>{sources.push(r.params);});root.walkAtRules('import',r=>{imports.push(r.params);});
  assert.deepEqual(sources,['"../layouts"','"../components"','"../pages"','"../ui"']);
  assert.ok(imports.some(i=>i.includes('utilities.css')&&i.includes('source(none)')));
  assert.ok(!imports.some(i=>i.includes('preflight')||i==='"tailwindcss"'));
  assert.ok(css.includes('@theme inline'));assert.ok(css.includes('@apply flex'));
});

test('inline tags share normal badge styling in base, hover and mobile rules without a second hash prefix',async()=>{
  const root=postcss.parse(await readFile('src/styles/site.css','utf8'));
  const variants=new Set<string>();
  root.walkRules(rule=>{
    if(rule.selectors.includes('.tag')&&rule.selectors.includes('.inline-tag'))variants.add(rule.parent?.type==='atrule'&&rule.parent.name==='media'?'mobile':'base');
    if(rule.selectors.includes('.tag:hover')&&rule.selectors.includes('.inline-tag:hover'))variants.add('hover');
    if(rule.selectors.some(selector=>selector.includes('.inline-tag')&&/:{1,2}before$/.test(selector)))assert.fail('inline tags already contain # in their text');
    if(rule.selector==='.inline-tag')rule.walkAtRules('apply',r=>assert.doesNotMatch(r.params,/\bunderline\b/));
  });
  assert.deepEqual(variants,new Set(['base','hover','mobile']));
});

test('narrow prose headings use inline text flow and hide only the permalink marker, not the explicit preview control',async()=>{
  const root=postcss.parse(await readFile('src/styles/site.css','utf8'));
  const rules:{selectors:string[];declarations:Record<string,string>}[]=[];
  root.walkRules(rule=>{
    if(rule.parent?.type!=='atrule'||rule.parent.name!=='media'||!rule.parent.params.includes('800px'))return;
    const declarations:Record<string,string>={};rule.walkDecls(decl=>{declarations[decl.prop]=decl.value;});
    rules.push({selectors:rule.selectors,declarations});
  });
  for(const selector of ['.prose h2','.prose h3'])assert.ok(rules.some(rule=>rule.selectors.includes(selector)&&rule.declarations.display==='block'),`${selector} must not split inline links and text into flex columns`);
  assert.ok(rules.some(rule=>rule.selectors.includes('.prose .heading-anchor')&&rule.declarations.display==='none'));
  assert.ok(!rules.some(rule=>rule.selectors.includes('.preview-button')&&rule.declarations.display==='none'),'Touch users still need explicit full-article previews');
});

test('The compiled-style verifier rejects raw Tailwind and missing interaction styles',()=>{
  assert.throws(()=>verifyStyles('.header-inner{@apply flex;}'),/Uncompiled Tailwind/);
  assert.throws(()=>verifyStyles('[hidden]{display:block}'),/Compiled CSS contract missing/);
});

test('all owned timed effects stay behind Motion; no native smooth scroll or timed CSS bypass',async()=>{
  for(const file of await readdir('src/runtime')){
    if(!/\.(js|ts)$/.test(file))continue;
    const source=await readFile(`src/runtime/${file}`,'utf8');
    assert.doesNotMatch(source,/\.animate\s*\(/,`${file}: raw WAAPI must not bypass Motion`);
    assert.doesNotMatch(source,/behavior\s*:\s*['"]smooth['"]/,`${file}: native smooth scrolling bypasses Motion`);
    assert.doesNotMatch(source,/\bsetInterval\s*\(/,`${file}: review persistent animation loops`);
    if(file!=='motion.ts')assert.doesNotMatch(source,/from\s*['"]motion(?:\/[^'"]*)?['"]/,`${file}: use the shared cancellation/reduced-motion boundary`);
  }
  const css=postcss.parse(await readFile('src/styles/site.css','utf8'));
  css.walkAtRules('apply',r=>assert.doesNotMatch(r.params,/\b(?:animate-|transition-|duration-)/));
  assert.throws(()=>verifyStyles('@keyframes bypass{to{opacity:1}}'),/bypass Motion/);
  assert.throws(()=>verifyStyles('a{transition:color .2s}'),/bypass Motion/);
  assert.throws(()=>verifyStyles('html{scroll-behavior:smooth}'),/bypass Motion/);
});

test('The comments component keeps the embedded service and retry without a duplicate Discussions link',async()=>{
  const source=await readFile('src/components/Comments.astro','utf8');
  assert.ok(source.includes('giscus-host'));assert.ok(source.includes('comments-retry'));assert.ok(source.includes('想法、补充，或只是打个招呼。'));
  assert.ok(!source.includes('comments-link'));assert.ok(!source.includes('在 GitHub Discussions 交流'));
});
