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
test('poetry remains literal Plaintext; adjacent public wikilinks support preview without extra icons',async()=>{
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
    assert.equal(find(tree,n=>attrs(n)['data-open-preview']||attrs(n).class==='preview-button').length,0);
    const links=find(tree,n=>n.tagName==='a'&&attrs(n).href==='/b');assert.equal(links.length,1);
    assert.equal(attrs(links[0])['data-preview'],'b.md');assert.equal(text(links[0]),'Other');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('Biro uses the same base-aware font declaration in dev and local built previews',()=>{
  assert.equal(biroURL('/'),'/fonts/biro-script-plus.woff2');assert.equal(biroURL('/preview/'),'/preview/fonts/biro-script-plus.woff2');
  assert.ok(biroStyles('/preview/').includes('url("/preview/fonts/biro-script-plus.woff2")'));assert.ok(biroStyles('/').includes('html[data-biro]{--hand:"Biro Script Plus"'));
});
