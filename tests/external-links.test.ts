import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseHTML, DOMParser } from 'linkedom';
import { buildSnapshot } from '../src/content/snapshot';
import { extractPreviewContent } from '../src/runtime/preview-content';
import { siteConfig, url } from '../src/site.config';

const md = (body: string) => `---\npublish: true\n---\n${body}`;
test('external text links receive a quiet decorative mark without changing labels, destinations or navigation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'notes-external-links-'));
  try {
    await writeFile(join(root, 'a.md'), md([
      '[External **label**](https://example.test/article?q=1#part)',
      '[Different host](https://virgiling.wiki.example.test/)',
      '[CV](https://cv.virgiling.wiki/)',
      '[[b|Internal]]',
      `[Same origin](${siteConfig.site}/b)`,
      '[Email](mailto:reader@example.test)',
      '[[missing|Unavailable]]',
      '[![Image](https://images.example.test/a.png)](https://example.test/photo)',
      '`https://example.test/code`',
      '## Heading',
      '[Section](#heading) and #tag',
      'Footnote[^1]\n\n[^1]: Footnote text',
    ].join('\n\n')));
    await writeFile(join(root, 'b.md'), md('Internal article'));
    const note = (await buildSnapshot(root)).notes.find(note => note.source === 'a.md')!;
    const { document } = parseHTML(`<div class="fixture">${note.html}</div>`);
    const marks = [...document.querySelectorAll('.external-link-mark')];
    assert.equal(marks.length, 3);
    for (const mark of marks) {
      assert.equal(mark.tagName, 'SPAN');
      assert.equal(mark.getAttribute('aria-hidden'), 'true');
      assert.equal(mark.textContent, '', 'decoration must not enter copied/indexed text');
      assert.equal(mark.hasAttribute('tabindex'), false);
      assert.equal(mark.parentElement!.tagName, 'A');
      assert.equal(mark.parentElement!.hasAttribute('target'), false, 'do not force a new tab');
    }
    const external = document.querySelector('a[href="https://example.test/article?q=1#part"]')!;
    assert.equal(external.textContent, 'External label');
    assert.equal(external.querySelector('strong')!.textContent, 'label');
    const internal = document.querySelector(`a[href="${url('b')}"]`)!;
    assert.equal(internal.getAttribute('data-preview'), 'b.md');
    assert.equal(internal.querySelector('.external-link-mark'), null);
    assert.ok(internal.classList.contains('internal-link'));
    for (const href of [`${siteConfig.site}/b`, `${url('a')}#heading`, url('404')])
      assert.ok(document.querySelector(`a[href="${href}"]:not(.heading-anchor)`)!.classList.contains('internal-link'), href);
    for (const selector of ['.heading-anchor', '.inline-tag', '[data-footnote-ref]', '[data-footnote-backref]']) {
      const control = document.querySelector(selector)!;
      assert.ok(control, selector);
      assert.equal(control.classList.contains('internal-link'), false, 'do not recolor controls or tag badges');
    }
    for (const href of [`${siteConfig.site}/b`, 'mailto:reader@example.test', url('404'), 'https://example.test/photo'])
      assert.equal(document.querySelector(`a[href="${href}"]`)!.querySelector('.external-link-mark'), null, href);
    assert.equal(document.querySelector('code .external-link-mark'), null);
    assert.doesNotMatch(note.readingText, /↗/);
    assert.doesNotMatch(note.summary, /↗/);
    const parser = new DOMParser() as unknown as globalThis.DOMParser;
    const preview = extractPreviewContent(`<article data-note-id="a.md"><div class="prose" data-preview-content>${note.html}</div></article>`, 'a.md', new URL('https://preview.test/preview/a'), 'external-preview', parser);
    assert.equal(preview.container.querySelectorAll('.external-link-mark').length, 3, 'imported previews preserve the marks');
    assert.equal(preview.container.querySelector('.prose')!.textContent, document.querySelector('.fixture')!.textContent);
  } finally { await rm(root, { recursive: true, force: true }); }
});
