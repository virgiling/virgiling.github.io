import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { buildArchivePagination } from '../src/ui/archive-pagination';
import { mapDirectoryMocs } from '../src/content/directory-moc';
import type { CatalogNote } from '../src/ui/types';
import { url } from '../src/site.config';
import { renderComponent } from './helpers/render-astro';

const doc = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const note = (source: string): CatalogNote => ({ source, slug: source, url: url(source.replace(/\.md$/, '')), title: source, summary: 'Summary', tags: [], date: '', updated: '', kind: 'article', publish: true, unlisted: false });

test('archive omits the root frame and counts only represented cards and mapped MoCs', async () => {
  const notes = [note('06-story/a.md'), note('story-toc.md'), { ...note('link.md'), tags: ['excluded'] }, note('orphan-toc.md')];
  const directories = mapDirectoryMocs(notes.map(n => ({ ...n, publish: true, unlisted: false })), [{ path: '06-story', title: '个人随笔' }]);
  const pagination = buildArchivePagination(notes, { directories });
  assert.deepEqual(pagination.pages.map(p => p.root.path), ['06-story']);
  assert.equal(pagination.pages[0].root.moc?.source, 'story-toc.md');
  const page = doc(await renderComponent('Archive', { notes, pagination, config: { directories } }));
  assert.equal(page.querySelector('[data-folder-root=""]'), null);
  assert.equal(page.querySelector('[data-note="link.md"],[data-note="orphan-toc.md"]'), null);
  assert.equal(page.querySelector('[data-directory-moc]')?.getAttribute('href'), url('story-toc'));
  assert.equal(page.querySelector('.archive-count')?.textContent?.trim(), '2 则笔记，慢慢生长。');
  const chip = page.querySelector('.archive-directories a')!;
  assert.equal(chip.querySelector('.archive-directory-number')?.textContent, '01');
  assert.equal(chip.querySelector('.archive-directory-count')?.textContent, '2');
  assert.ok(chip.hasAttribute('data-control-motion'));
  assert.ok(page.querySelector('.folder-heading-link[data-control-motion]'));
});

test('archive has one pager above its frame, not a duplicate footer pager or a page-number window', async () => {
  const notes = Array.from({ length: 53 }, (_, i) => note(`folder/${i}.md`));
  const pagination = buildArchivePagination(notes, { pageSize: 20 });
  const html = await renderComponent('Archive', { notes, pagination, pageIndex: 1 });
  const page = doc(html);
  assert.equal(page.querySelectorAll('.archive-pagination').length, 1);
  assert.ok(html.indexOf('class="archive-pagination"') < html.indexOf('class="folder-tree"'));
  assert.equal(page.querySelectorAll('.archive-pagination a').length, 4);
  assert.equal(page.querySelector('.archive-pagination [aria-current="page"]')?.textContent?.trim(), '2 / 3');
  assert.equal(page.querySelector('.archive-pagination [rel="prev"]')?.getAttribute('href'), url('articles'));
  assert.equal(page.querySelector('.archive-pagination [rel="next"]')?.getAttribute('href'), url('articles/3'));
  assert.equal(page.querySelectorAll('.archive-pagination a[data-control-motion]').length, 4);
});

test('compact pagination has native first/previous/next/last links and inert boundary controls', async () => {
  for (const index of [0, 5, 9]) {
    const page = doc(await renderComponent('ArchivePagination', { index, total: 10 }));
    const first = page.querySelector('[aria-label="第一页"]')!;
    const previous = page.querySelector('[aria-label="上一页"]')!;
    const next = page.querySelector('[aria-label="下一页"]')!;
    const last = page.querySelector('[aria-label="最后一页"]')!;
    assert.equal(page.querySelectorAll('.archive-pagination > *').length, 5);
    assert.equal(first.getAttribute('href'), index === 0 ? null : url('articles'));
    assert.equal(last.getAttribute('href'), index === 9 ? null : url('articles/10'));
    for (const control of index === 0 ? [first, previous] : index === 9 ? [next, last] : []) {
      assert.equal(control.getAttribute('aria-disabled'), 'true');
      assert.equal(control.tagName, 'SPAN');
      assert.equal(control.hasAttribute('data-control-motion'), false);
      assert.equal(control.hasAttribute('tabindex'), false);
    }
    assert.equal(page.querySelector('[aria-current="page"]')?.getAttribute('aria-label'), `第 ${index + 1} 页，共 10 页`);
  }
  assert.equal(doc(await renderComponent('ArchivePagination', { index: 0, total: 1 })).querySelector('nav'), null);
});
