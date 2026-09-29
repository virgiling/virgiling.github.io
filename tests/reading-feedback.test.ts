import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'parse5';
import {buildSnapshot} from '../src/content/snapshot';
import {biroStyles,biroURL} from '../src/fonts';
const text=(node:any):string=>node.value??(node.childNodes||[]).map(text).join('');
const attrs=(node:any)=>Object.fromEntries((node.attrs||[]).map((a:{name:string;value:string})=>[a.name,a.value]));
function find(node:any,predicate:(n:any)=>boolean):any[]{return [...(predicate(node)?[node]:[]),...(node.childNodes||[]).flatMap((n:any)=>find(n,predicate))];}
test('poetry is literal Plaintext in a code frame; only the adjacent public wikilink has a pin button',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-reading-feedback-'));
  try{
    const poetry='  First line\n[[a]] %% literal %%\n<script>literal</script>';
    await writeFile(join(root,'a.md'),'---\npublish: true\n---\n```poetry\n'+poetry+'\n```\n\n[[b|Other]] [external](https://example.test)');
    await writeFile(join(root,'b.md'),'---\npublish: true\n---\nTarget');
    const snapshot=await buildSnapshot(root),html=snapshot.notes.find(n=>n.id==='a.md')!.html,tree=parse(html);
    const blocks=find(tree,n=>n.tagName==='pre');assert.equal(blocks.length,1);assert.equal(attrs(blocks[0]).tabindex,'0');
    const code=find(blocks[0],n=>n.tagName==='code')[0];assert.equal(text(code).trimEnd(),poetry);
    assert.equal(find(code,n=>n.tagName==='a'||n.tagName==='script').length,0);
    assert.equal(find(code,n=>attrs(n).style).length,0,'plaintext lines have no syntax coloring');
    const pins=find(tree,n=>n.tagName==='button'&&attrs(n)['data-open-preview']);assert.equal(pins.length,1);
    assert.equal(attrs(pins[0])['aria-label'],'固定预览：Other');assert.equal(attrs(pins[0])['aria-haspopup'],'dialog');assert.equal(attrs(pins[0])['aria-controls'],'note-preview');
    assert.equal(find(pins[0],n=>n.tagName==='svg').length,1);assert.ok(!text(pins[0]).includes('↗'));
    assert.equal(find(tree,n=>n.tagName==='a'&&attrs(n).href==='/b').length,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('Biro uses the same base-aware font declaration in dev and local built previews',()=>{
  assert.equal(biroURL('/'),'/fonts/biro-script-plus.woff2');assert.equal(biroURL('/preview/'),'/preview/fonts/biro-script-plus.woff2');
  assert.ok(biroStyles('/preview/').includes('url("/preview/fonts/biro-script-plus.woff2")'));assert.ok(biroStyles('/').includes('html[data-biro]{--hand:"Biro Script Plus"'));
});
