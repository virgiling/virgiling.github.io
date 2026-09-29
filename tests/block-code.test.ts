import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSnapshot} from '../src/content/snapshot';
test('Shiki does not discard a block anchor attached after a code fence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notes-block-'));
  try{
    await writeFile(join(root,'a.md'),'---\npublish: true\n---\n```css\na { color: red }\n```\n^code-id\n\n[[#^code-id|代码配置]]');
    const note=(await buildSnapshot(root)).notes[0];assert.match(note.html,/id="block-code-id"/);assert.match(note.html,/href="\/a#block-code-id"/);
  }finally{await rm(root,{recursive:true,force:true});}
});
