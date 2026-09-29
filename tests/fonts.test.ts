import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {collectUICharacters,ensureFonts,generated} from '../scripts/fonts/subset-ui-font';
import {cleanFonts} from '../scripts/fonts/clean';
import {biroPath,hasBiro} from '../src/fonts';

test('font collector follows actual renderer text, handles astral glyphs, never scans content or research files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-font-test-'));
  try{
    for(const dir of ['src/pages','content','.pi/research'])await mkdir(join(root,dir),{recursive:true});
    await writeFile(join(root,'src/pages/example.astro'),'<h2>旅途还在继续𠮷</h2>');
    await writeFile(join(root,'content/private.md'),'---\npublish: false\n---\n龘');
    await writeFile(join(root,'.pi/research/private.txt'),'靐');
    const chars=await collectUICharacters(root);for(const c of '旅途还在继续𠮷')assert.ok(chars.includes(c));
    assert.ok(!chars.includes('龘')&&!chars.includes('靐'));assert.ok(chars.includes('A'));assert.equal([...chars].length,new Set(chars).size);
    await writeFile(join(root,'src/pages/example.astro'),'<h2>新增界面</h2>');assert.ok((await collectUICharacters(root)).includes('增'));
    await symlink(join(root,'content'),join(root,'src/styles'));await assert.rejects(collectUICharacters(root),/symbolic links/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('generated fonts preserve full source coverage, UI priority and truthful static weights, not prototype glyph lists',async()=>{
  await ensureFonts();const manifest=JSON.parse(await readFile(join(generated,'manifest.json'),'utf8'));
  const css=await readFile(join(generated,'fonts.css'),'utf8');assert.doesNotMatch(css,/font-weight:100 900|font-weight:600 900/);
  for(const font of manifest.fonts){
    const all=new Set(font.files.flatMap((f:any)=>f.codepoints));assert.equal(all.size,font.sourceCodepoints);
    assert.equal(font.files.at(-1).ui,true,'last face takes precedence for UI glyphs');assert.ok([400,700].includes(font.weight));
    for(const file of font.files){const bytes=await readFile(join(generated,file.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  }
  const cjk=manifest.fonts.find((f:any)=>f.id==='notes-cjk');assert.equal(cjk.sourceCodepoints,25598);
  const ui=new Set(cjk.files.at(-1).codepoints);for(const c of '旅途还在继续')assert.ok(ui.has(c.codePointAt(0)));
  assert.ok(cjk.files.some((f:any)=>!f.ui&&f.codepoints.some((c:number)=>!ui.has(c))),'fallback includes characters absent from UI');
  const journey=await readFile('src/pages/journey.astro','utf8');assert.match(journey,/class="journey-empty"/);
});

test('original Biro lives with the source fonts and remains byte-identical',async()=>{
  assert.equal(biroPath(),join(process.cwd(),'assets/fonts/biro-script-plus.woff2'));assert.ok(hasBiro());
  assert.equal(createHash('sha256').update(await readFile(biroPath())).digest('hex'),'e2448f3e978a17f04c78701e1d9565bd74c2275f58e7d315ef258ecf3ca40619');
});
async function fontFixture(){
  const root=await mkdtemp(join(tmpdir(),'notes-font-clean-')),active='aaaaaaaaaaaaaaaa/ui.woff2',obsolete='bbbbbbbbbbbbbbbb/old.woff2';
  for(const dir of ['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb'])await mkdir(join(root,dir));
  const bytes=Buffer.from('fixture font'),css=`@font-face{src:url("./${active}")}`;
  const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
  const manifest={cssSha256:hash(css),fonts:[{files:[{file:active,sha256:hash(bytes)}]}]};
  await writeFile(join(root,active),bytes);await writeFile(join(root,obsolete),'obsolete');await writeFile(join(root,'legacy.woff2'),'legacy');
  await writeFile(join(root,'fonts.css'),css);await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));
  return {root,active,obsolete,bytes,css,manifest,hash};
}
test('font cleanup keeps exactly the manifest/CSS set and is idempotent',async()=>{
  const f=await fontFixture();try{
    const result=await cleanFonts(f.root);assert.equal(result.removedFiles,2);assert.equal(result.removedBytes,14);assert.equal(result.keptFiles,3);
    assert.deepEqual(await readFile(join(f.root,f.active)),f.bytes);assert.equal(await readFile(join(f.root,'fonts.css'),'utf8'),f.css);
    await assert.rejects(readFile(join(f.root,f.obsolete)),/ENOENT/);assert.equal((await cleanFonts(f.root)).removedFiles,0);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('font cleanup refuses corrupt/incomplete inputs and CSS disagreement before deleting anything',async()=>{
  const f=await fontFixture();try{
    await writeFile(join(f.root,f.active),'corrupt');await assert.rejects(cleanFonts(f.root),/checksum/);assert.equal(await readFile(join(f.root,f.obsolete),'utf8'),'obsolete');
    await rm(join(f.root,f.active));await assert.rejects(cleanFonts(f.root),/ENOENT/);assert.equal(await readFile(join(f.root,f.obsolete),'utf8'),'obsolete');
    await writeFile(join(f.root,f.active),f.bytes);const css=f.css.replace('ui.woff2','missing.woff2');
    await writeFile(join(f.root,'fonts.css'),css);await writeFile(join(f.root,'manifest.json'),JSON.stringify({...f.manifest,cssSha256:f.hash(css)}));
    await assert.rejects(cleanFonts(f.root),/same fonts/);assert.equal(await readFile(join(f.root,f.obsolete),'utf8'),'obsolete');
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('font cleanup rejects symlinks and traversal paths',async()=>{
  const f=await fontFixture();try{
    const link=join(f.root,'linked');await symlink(join(f.root,'aaaaaaaaaaaaaaaa'),link);await assert.rejects(cleanFonts(link),/symlink/);await assert.rejects(cleanFonts(f.root),/symlink/);await rm(link);
    f.manifest.fonts[0].files[0].file='../outside.woff2';await writeFile(join(f.root,'manifest.json'),JSON.stringify(f.manifest));await assert.rejects(cleanFonts(f.root),/Invalid generated font path/);
    assert.equal(await readFile(join(f.root,f.obsolete),'utf8'),'obsolete');
  }finally{await rm(f.root,{recursive:true,force:true});}
});
