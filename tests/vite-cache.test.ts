import {test} from 'node:test';
import assert from 'node:assert/strict';
import {viteCacheDirectory} from '../src/dev/vite-cache';

test('Vite cache is stable but isolated across author/dev-check/measurement/build and bases',()=>{
  const root=new URL('file:///project/');
  const main=viteCacheDirectory(root,'dev',4321,'/');
  assert.equal(main,viteCacheDirectory(root,'dev',4321,'/'));
  const variants=[main,viteCacheDirectory(root,'dev',14323,'/'),viteCacheDirectory(root,'dev',14322,'/'),viteCacheDirectory(root,'build',4321,'/'),viteCacheDirectory(root,'dev',4321,'/preview/')];
  assert.equal(new Set(variants).size,variants.length);
  assert.ok(variants.every(p=>p.startsWith('/project/node_modules/.vite/notes-')));
});
