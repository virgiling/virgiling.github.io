import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';

const workflow=parse(await readFile(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8'));
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const steps=workflow.jobs.build.steps;
const action=(name:string)=>steps.find((step:any)=>step.uses?.startsWith(name+'@'));

test('Pages builds main and deploys only after successful validation with scoped permissions',()=>{
  assert.deepEqual(workflow.on.push.branches,['main']);
  assert.ok(Object.hasOwn(workflow.on,'workflow_dispatch'));
  assert.deepEqual(workflow.on.schedule,[{cron:'23 */6 * * *'}]);
  assert.deepEqual(workflow.permissions,{});
  assert.deepEqual(workflow.jobs.build.permissions,{contents:'read'});
  const deploy=workflow.jobs.deploy;
  assert.equal(deploy.needs,'build');
  assert.equal(deploy.if,"github.ref == 'refs/heads/main'");
  assert.deepEqual(deploy.permissions,{pages:'write','id-token':'write'});
  assert.equal(deploy.environment.name,'github-pages');
  assert.equal(deploy.environment.url,'${{ steps.deployment.outputs.page_url }}');
  assert.ok(deploy.steps.some((step:any)=>step.id==='deployment'&&step.uses.startsWith('actions/deploy-pages@')));
  assert.deepEqual(workflow.concurrency,{group:'pages','cancel-in-progress':false});
});

test('Pages checks out the recorded private content without retaining credentials or following a branch',()=>{
  const checkout=action('actions/checkout');
  assert.equal(steps[0],checkout);
  assert.equal(checkout.with.token,'${{ secrets.BLOGS }}');
  assert.equal(checkout.with.submodules,'recursive');
  assert.equal(checkout.with['persist-credentials'],false);
  assert.equal(checkout.with.ref,undefined);
  assert.doesNotMatch(steps.map((step:any)=>step.run||'').join('\n'),/--remote|git\s+pull/);
});

test('Pages uses locked tools, validates and HTTP-checks before uploading only dist',()=>{
  assert.equal(action('actions/setup-node').with['node-version'],'24.19.0');
  assert.equal('bun@'+action('oven-sh/setup-bun').with['bun-version'],pkg.packageManager);
  const uv=action('astral-sh/setup-uv');
  assert.match(uv.with.version,/^\d+\.\d+\.\d+$/);
  assert.equal(uv.with['python-version'],'3.12');
  assert.equal(workflow.jobs.build.env.SITE_BASE,'/');
  const install=steps.findIndex((step:any)=>step.run==='bun install --frozen-lockfile');
  const validate=steps.findIndex((step:any)=>step.run==='bun run validate');
  const http=steps.findIndex((step:any)=>step.run==='bun run verify:http');
  const upload=steps.indexOf(action('actions/upload-pages-artifact'));
  assert.ok(install>=0&&install<validate&&validate<http&&http<upload);
  assert.equal(steps[upload].with.path,'dist');
  assert.equal(steps.filter((step:any)=>step.uses?.includes('upload')).length,1);
  assert.ok(steps.every((step:any)=>!step['continue-on-error']));
});

test('Pages pins third-party actions and does not cache private build inputs',()=>{
  for(const job of Object.values(workflow.jobs) as any[]){
    assert.ok(job['timeout-minutes']>0);
    for(const step of job.steps){
      if(step.uses)assert.match(step.uses,/^[\w-]+\/[\w-]+@[a-f0-9]{40}$/);
      if(step.uses?.startsWith('actions/cache@'))assert.equal(step.with.path,'.astro/friends','Only normalized public feed snapshots may be cached');
    }
  }
  assert.equal(action('astral-sh/setup-uv').with['enable-cache'],false);
  assert.equal(workflow.jobs.build.env.FRIENDS_REFRESH,'1');
});
