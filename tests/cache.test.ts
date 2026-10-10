import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createSnapshotCache} from '../src/content/cache';
import {registerContentWatcher,watchedContentPath} from '../src/dev/content-watch';

test('concurrent and repeated requests share one successful snapshot',async()=>{
  let calls=0;const cache=createSnapshotCache(async()=>({generation:++calls}));
  const first=cache.get();assert.equal(first,cache.get());
  assert.equal(await first,await cache.get());assert.equal(calls,1);
  cache.invalidate();assert.equal((await cache.get()).generation,2);assert.equal(calls,2);
});
test('failed compilation can retry without pinning a rejected promise',async()=>{
  let calls=0;const cache=createSnapshotCache(async()=>{if(++calls===1)throw new Error('temporary failure');return 'ready';});
  await assert.rejects(cache.get());assert.equal(await cache.get(),'ready');assert.equal(calls,2);
});
test('content change during compilation does not return an obsolete publication snapshot',async()=>{
  const deferred:((value:string)=>void)[]=[];
  const cache=createSnapshotCache(()=>new Promise<string>(resolve=>deferred.push(resolve)));
  const old=cache.get();await Promise.resolve();cache.invalidate();const current=cache.get();await Promise.resolve();
  deferred[0]('obsolete public content');deferred[1]('current filtered content');
  assert.equal(await old,'current filtered content');assert.equal(await current,'current filtered content');
});
test('watch boundary excludes private directories, credentials and files outside content',()=>{
  for(const path of ['/content/private/secret.md','/content/.obsidian/a.json','/content/folder/.env','/content/api-token.md','/outside/a.md','/content/10-daily/log.md'])assert.equal(watchedContentPath(path,'/content'),false,path);
  for(const path of ['/content/index.md','/content/dir/a.md','/content/dir/photo.png'])assert.equal(watchedContentPath(path,'/content'),true,path);
});
test('content events invalidate both content and Astro route caches, not just the browser',()=>{
  const watcher=new EventEmitter() as EventEmitter&{add:(root:string)=>void};watcher.add=()=>{};
  const events:string[]=[],reload:any[]=[];
  const server={watcher,environments:{client:{hot:{send:()=>assert.fail('SSR events must not be sent to client')}},ssr:{hot:{send:(e:string)=>events.push(e)}},prerender:{hot:{send:(e:string)=>events.push(e)}}},ws:{send:(e:unknown)=>reload.push(e)}};
  const cleanup=registerContentWatcher(server,'/content');
  watcher.emit('all','change','/content/private/a.md');assert.equal(events.length,0);
  watcher.emit('all','change','/content/index.md');assert.deepEqual(events,['notes:content-changed','astro:content-changed','notes:content-changed','astro:content-changed']);assert.equal(reload.length,1);
  watcher.emit('all','change','/content/ref.bib');assert.equal(reload.length,2);assert.equal(events.length,8);
  watcher.emit('all','change','/content/nested/ref.bib');assert.equal(reload.length,2);
  cleanup();watcher.emit('all','change','/content/index.md');assert.equal(reload.length,2);
});
