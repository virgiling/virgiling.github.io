import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSnapshot} from '../src/content/snapshot';
import {parseHTML} from 'linkedom';
test('code blocks retain highlighted and literal content without language bars or static copy buttons',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-code-layout-'));
  try{
    const bodies=['```js\nconst n = 1;\n```','```poetry\n  春眠\n不觉晓\n```','```unknown-fixture-language\n<literal> & text\n```','```\n\tplain text\n```'];
    await writeFile(join(root,'a.md'),'---\npublish: true\n---\n'+bodies.join('\n\n'));
    const note=(await buildSnapshot(root)).notes[0];
    const {document}=parseHTML(`<html><body>${note.html}</body></html>`);
    assert.equal(document.querySelectorAll('.code-block > pre').length,4);
    assert.equal(document.querySelector('.code-toolbar,.code-language,.copy-code'),null);
    assert.deepEqual([...document.querySelectorAll('pre code')].map(code=>code.textContent),['const n = 1;','  春眠\n不觉晓','<literal> & text','\tplain text\n']);
    assert.ok(document.querySelector('pre.shiki span[style]'));
    assert.ok([...document.querySelectorAll('pre')].every(pre=>pre.getAttribute('tabindex')==='0'));
    assert.equal(document.querySelector('literal'),null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Shiki does not discard a block anchor attached after a code fence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-block-'));
  try{
    await writeFile(join(root,'a.md'),'---\npublish: true\n---\n```css\na { color: red }\n```\n^code-id\n\n[[#^code-id|代码配置]]');
    const note=(await buildSnapshot(root)).notes[0];assert.match(note.html,/id="block-code-id"/);assert.match(note.html,/href="\/a#block-code-id"/);
  }finally{await rm(root,{recursive:true,force:true});}
});
