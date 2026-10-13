import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

test('userland Punycode preserves ASCII, internationalized domains and astral Unicode helpers', () => {
  const punycode = createRequire(import.meta.url)('punycode/punycode.js') as {
    toASCII(input: string): string;
    toUnicode(input: string): string;
    ucs2: { decode(input: string): number[]; encode(input: number[]): string };
  };
  for (const [unicode, ascii] of [['example.com', 'example.com'], ['例子.测试', 'xn--fsqu00a.xn--0zwm56d'], ['mañana.com', 'xn--maana-pta.com']]) {
    assert.equal(punycode.toASCII(unicode), ascii);
    assert.equal(punycode.toUnicode(ascii), unicode);
  }
  assert.deepEqual(punycode.ucs2.decode('A😀'), [0x41, 0x1f600]);
  assert.equal(punycode.ucs2.encode([0x41, 0x1f600]), 'A😀');
});

for (const entry of ['rehype-citation', new URL('./cite.mjs', import.meta.resolve('rehype-citation')).href]) {
  test(`citation Node entry loads without runtime deprecation warnings: ${entry.split('/').at(-1)}`, () => {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_NO_WARNINGS;
    // A fresh Node process catches the warning even if another test already
    // imported the built-in; throw rather than filtering stderr or warnings.
    const result = spawnSync('node', ['--throw-deprecation', '--input-type=module', '-e', `await import(${JSON.stringify(entry)})`], { encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.doesNotMatch(result.stderr, /DEP0040|punycode.*deprecated/);
  });
}
