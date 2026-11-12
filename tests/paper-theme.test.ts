import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSiteStyles } from './helpers/styles';
import { parseHTML } from 'linkedom';
import { calloutAliases, calloutHTML } from '../src/markdown/callouts';
import { expectedCalloutBackgrounds } from '../scripts/styles-contract';

async function palette() {
  const root = await readSiteStyles();
  const tokens: Record<string, string> = {};
  root.walkRules(rule => {
    if (rule.selector === ':root') rule.walkDecls(declaration => { tokens[declaration.prop] = declaration.value; });
  });
  return { root, tokens };
}
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

test('original light surfaces and green accents remain intact without recoloring text', async () => {
  const { root, tokens } = await palette();
  assert.equal(tokens['--paper'], '#faf9f6');
  assert.equal(tokens['--surface'], '#fffefb');
  assert.equal(tokens['--soft'], '#eef1e8');
  assert.equal(tokens['--line'], '#e2e4db');
  for (const [name, value] of Object.entries({ '--ink': '#353a35', '--muted': '#687068', '--accent': '#486447', '--metadata': '#6d756a' })) assert.equal(tokens[name], value);
  const backgrounds = new Map<string, string>();
  root.walkRules(rule => rule.walkDecls('background', declaration => {
    for (const selector of rule.selectors) backgrounds.set(selector, declaration.value);
  }));
  for (const selector of ['.note-card', '.popover', 'dialog']) assert.equal(backgrounds.get(selector), 'var(--surface)');
  for (const selector of ['.tag', '.inline-tag']) assert.equal(backgrounds.get(selector), '#e7eddf');
  assert.equal(backgrounds.get('.prose :not(pre) > code'), '#e2e6df');
  assert.equal(backgrounds.get('.popover-top'), '#f0f3e9');
  assert.equal(backgrounds.get('.search-result:hover'), '#edf1e5');
});

test('paper theme retains main text and label contrast without treating it as whole-site AA certification', async () => {
  const { tokens } = await palette();
  assert.ok(contrast(tokens['--ink'], tokens['--paper']) >= 7);
  assert.ok(contrast(tokens['--accent'], tokens['--paper']) >= 4.5);
  assert.ok(contrast(tokens['--accent'], '#d8e4cd') >= 4.5);
  assert.ok(contrast(tokens['--metadata'], tokens['--surface']) >= 4.5);
  assert.ok(contrast(tokens['--muted'], tokens['--paper']) >= 4.5);
  assert.ok(contrast(tokens['--metadata'], tokens['--paper']) >= 4.5);
  // These specific pairs are not whole-site AA certification.
});

test('heatmap intensity remains ordered while graph text and semantic callout colors remain unchanged', async () => {
  const { root } = await palette();
  const values: Record<string, Record<string, string>> = {};
  root.walkRules(rule => {
    const declarations: Record<string, string> = {};
    rule.walkDecls(d => { declarations[d.prop] = d.value; });
    for (const selector of rule.selectors) values[selector] = { ...values[selector], ...declarations };
  });
  const selectors = ['.heatmap-day', ...[1, 2, 3, 4].map(level => `.heatmap-day.level-${level}`)];
  const lightness = selectors.map(selector => luminance(values[selector].fill));
  for (let i = 1; i < lightness.length; i++) assert.ok(lightness[i] < lightness[i - 1]);
  assert.deepEqual(selectors.map(selector => values[selector].fill), ['#e7ebdf', '#c4d2b6', '#9db888', '#769b61', '#486c3e']);
  assert.equal(values['.heatmap-day.is-future'].fill, 'transparent');
  assert.equal(values['.graph text'].fill, '#5d6f51');
  assert.equal(values['.graph .page-node'].fill, '#728d5c');
  assert.equal(values['.callout[data-callout-kind="success"]']['--callout-color'], '#357054');
  assert.equal(values['.callout[data-callout-kind="warning"]']['--callout-color'], '#8b5b22');
  assert.equal(values['.callout']['--callout-border'], '#bbcbdc');
  assert.equal(values['.callout[data-callout-kind="success"]']['--callout-border'], '#a7cdb4');
  assert.equal(values['.callout[data-callout-kind="warning"]']['--callout-border'], '#debf89');
  assert.equal(values['.callout[data-callout-kind="aigc"]']['--callout-color'], '#94465f');
  assert.equal(values['.callout[data-callout-kind="aigc"]']['--callout-border'], '#e2bac9');
  assert.notEqual(expectedCalloutBackgrounds.aigc, expectedCalloutBackgrounds.info);
  assert.notEqual(expectedCalloutBackgrounds.aigc, expectedCalloutBackgrounds.danger);
});

test('rendered callout kinds and aliases select independent opaque backgrounds, also when nested', async () => {
  const { root } = await palette();
  function paint(element: Element) {
    const result: Record<string,string> = {};
    root.walkRules(rule => {
      if (!rule.nodes.some(node => node.type === 'decl' && node.prop.startsWith('--callout-'))) return;
      if (!rule.selectors.some(selector => element.matches(selector))) return;
      rule.walkDecls(d => { result[d.prop] = d.value; });
    });
    return result;
  }
  for (const [type, kind] of [...Object.entries(calloutAliases), ['custom-type', 'note']]) {
    const { document } = parseHTML(calloutHTML({type, fold:'-'}));
    const callout = document.querySelector('.callout')!;
    assert.equal(callout.getAttribute('data-callout-kind'), kind);
    const colors = paint(callout), expected = expectedCalloutBackgrounds[type === 'important' ? type : kind];
    assert.equal(colors['--callout-bg'], expected, `${type}: type surface must not collapse into the page color`);
    assert.ok(contrast(colors['--callout-color'], expected) >= 4.5, `${type}: title contrast`);
    assert.equal(colors.opacity, undefined, 'background adjustments must not fade text');
  }
  const { document } = parseHTML(calloutHTML({type:'warning'}));
  document.querySelector('.callout-content')!.innerHTML = calloutHTML({type:'example',fold:'+'});
  const outer = document.querySelector('.callout')!, inner = outer.querySelector('.callout')!;
  assert.equal(paint(outer)['--callout-bg'], expectedCalloutBackgrounds.warning);
  assert.equal(paint(inner)['--callout-bg'], expectedCalloutBackgrounds.example);
  assert.equal(inner.tagName, 'DETAILS'); assert.ok(inner.hasAttribute('open'));
});
