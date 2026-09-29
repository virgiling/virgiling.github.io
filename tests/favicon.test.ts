import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';

test('favicon retains the original site PNG without conversion',async()=>{
  // Original URL: https://virgiling.wiki/static/icon.png
  const bytes=await readFile(new URL('../public/favicon.png',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'b5b4faf1f720ff7464d4965e7745354f92194c21a0770752a5be743749a5dedb');
  const meta=imageSize(bytes);assert.equal(meta.type,'png');assert.equal(meta.width,32);assert.equal(meta.height,32);
});
