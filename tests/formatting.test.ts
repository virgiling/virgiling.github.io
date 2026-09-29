import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getFileInfo,resolveConfig,format} from 'prettier';

test('formatter includes content compiler sources but excludes generated fonts and content submodule',async()=>{
  for(const path of ['src/content/compile.ts','src/layouts/SiteLayout.astro','src/runtime/site.js','src/styles/site.css']){
    assert.equal((await getFileInfo(path,{ignorePath:'.prettierignore'})).ignored,false,path);
  }
  for(const path of ['src/fonts/generated/fonts.css','content/index.md']){
    assert.equal((await getFileInfo(path,{ignorePath:'.prettierignore'})).ignored,true,path);
  }
});

test('Astro formatter uses JSX whitespace semantics and produces stable output',async()=>{
  const config=await resolveConfig('src/layouts/SiteLayout.astro');assert.ok(config);
  assert.equal((config as any).astroCompressHTML,'jsx');
  const source='---\nconst title="Notes";\n---\n<h1>{title}</h1>\n';
  const once=await format(source,{...config,filepath:'src/pages/format-fixture.astro'});
  assert.equal(await format(once,{...config,filepath:'src/pages/format-fixture.astro'}),once);
});
