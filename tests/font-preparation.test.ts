import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontPreparation} from '../src/integrations/font-preparation';

test('font preparation has its own integration name and logs before waiting for work',async()=>{
  let release!:()=>void;const logs:string[]=[];
  const integration=fontPreparation(()=>new Promise<void>(resolve=>{release=resolve;}));
  assert.equal(integration.name,'notes-font-preparation');
  const hook=integration.hooks['astro:config:setup']!;
  const task=hook({command:'build',logger:{info:(message:string)=>logs.push(message)}} as any);
  assert.deepEqual(logs,['Validating font sources and preparing subsets…']);
  release();await task;assert.match(logs[1],/^Font preparation complete \(/);
});
test('preview does not prepare fonts and preparation failures retain their original cause',async()=>{
  const failure=new Error('bad font checksum'),logs:string[]=[];let calls=0;
  const integration=fontPreparation(async()=>{calls++;throw failure;});
  const logger={info:(message:string)=>logs.push(message),error:(message:string)=>logs.push(message)};
  await integration.hooks['astro:config:setup']!({command:'preview',logger} as any);assert.equal(calls,0);assert.equal(logs.length,0);
  await assert.rejects(async()=>integration.hooks['astro:config:setup']!({command:'dev',logger} as any),failure);
  assert.equal(calls,1);assert.equal(logs.at(-1),'Font preparation failed.');assert.ok(!logs.some(log=>log.includes('complete')));
});
