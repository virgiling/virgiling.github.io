import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderComponent} from './helpers/render-astro';
import {navigation,url} from '../src/site.config';
const note=(slug:string,updated:string)=>({slug,source:slug+'.md',title:slug,url:'/'+slug,kind:'article',date:'2020-01-01',updated,tags:[],summary:'Summary'});

test('updates uses descending lastmod, stable ties, date fallback, and ordinary cards without stacks',async()=>{
  const old=note('01-courses/old','2020-02-01'),recent=note('03-tools/new','2026-09-01'),tie=note('02-research/tie','2026-09-01'),fallback=note('06-story/fallback','');
  const html=await renderComponent('Updates',{pages:[old,recent,tie,fallback,{...note('hidden','2099-01-01'),unlisted:true},{...note('private','2099-01-01'),publish:false},{...note('index','2099-01-01'),kind:'landing'}]});
  assert.ok(html.indexOf('data-note="02-research/tie"')<html.indexOf('data-note="03-tools/new"'));
  assert.ok(html.indexOf('data-note="03-tools/new"')<html.indexOf('data-note="01-courses/old"'));
  assert.match(html,/class="card-list"/);assert.doesNotMatch(html,/stack-card|stack-count|ghost-title|2099|按目录浏览/);
  assert.match(html,/最近更新 <time datetime="2026-09-01"/);assert.match(html,/最近更新 <time datetime="2020-01-01"/);
});
test('homepage exposes updates via a base-aware native link, not the primary navigation',async()=>{
  assert.ok((await renderComponent('HomeActivity',{pages:[note('a','2026-09-01')],config:{}})).includes(`href="${url('updates')}"`));
  assert.ok(!navigation.some(item=>item.url===url('updates')));
  assert.match(await renderComponent('Updates',{pages:[]}),/暂时没有文章更新/);
});
