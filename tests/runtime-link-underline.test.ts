import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Element as MotionElement, environment } from './helpers/runtime-bundle';
import { readSiteStyles } from './helpers/styles';

function setup() {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const styles = new Map<MotionElement, { textDecorationLine: string; backgroundImage: string }>();
  const api = environment({ document, Element: MotionElement, HTMLElement: MotionElement,
    getComputedStyle: (element: MotionElement) => styles.get(element) });
  function link(options: { external?: boolean; excluded?: boolean; image?: boolean; underlined?: boolean; background?: string } = {}) {
    const classes = new Set<string>();
    const element = Object.assign(new MotionElement(), {
      namespaceURI: 'http://www.w3.org/1999/xhtml', textContent: 'Ordinary link',
      classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name), toggle: () => false },
      closest: (selector: string): MotionElement | null => selector === 'a[href]' || options.excluded ? element : null,
      querySelector: (selector: string) => (selector === '.external-link-mark' ? options.external !== false : options.image) ? new MotionElement() : undefined,
    });
    styles.set(element, { textDecorationLine: options.underlined === false ? 'none' : 'underline', backgroundImage: options.background || 'none' });
    return { element, classes };
  }
  function event(type: string, target: MotionElement, values: Record<string, unknown> = {}) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    Object.assign(event, { pointerType: 'mouse', relatedTarget: null }, values);
    document.dispatchEvent(event);
    return event;
  }
  return { document, api, link, event, controller: api.initLinkUnderline() };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('external link hover draws left to right through shared Motion without taking over clicks', async () => {
  const e = setup(), { element, classes } = e.link();
  element.style.setProperty('background-size', '37% 2px');
  e.event('pointerover', element);
  assert.equal(element.animations.length, 1);
  assert.deepEqual(Array.from(element.animations[0].keyframes.backgroundSize as string[]), ['0% 2px', '100% 2px']);
  assert.equal(element.animations[0].duration, 300, 'the full sweep needs its own duration, not the fast navigation timing');
  assert.equal(element.animations[0].easing, 'linear', 'progress must remain visible throughout the sweep');
  assert.ok(classes.has('is-link-underlined'));
  e.event('pointerover', element); // Moving between children must not restart the sweep.
  assert.equal(element.animations.length, 1);
  element.animations[0].finish(); await tick();
  assert.ok(classes.has('is-link-underlined'), 'CSS retains the completed underline');
  assert.equal(element.style.getPropertyValue('background-size'), '37% 2px');
  for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }, { button: 1 }])
    assert.equal(e.event('click', element, modifiers).defaultPrevented, false);
  e.event('pointerout', element);
  assert.equal(classes.size, 0, 'leaving restores the native underline');
  e.controller.destroy();
});

test('the external link sweep does not change other shared Motion timings or easing', async () => {
  const e = setup(), { element } = e.link();
  const completion = e.api.transition(element, { opacity: [0, 1] }, e.api.durations.navigation);
  assert.equal(element.animations[0].duration, 180);
  assert.equal(element.animations[0].easing.replace(/\s/g, ''), 'cubic-bezier(0.22,1,0.36,1)');
  element.animations[0].finish(); await completion;
  e.controller.destroy();
});

test('focus and hover share one underline; rapid changes cancel and dynamic preview links need no setup', () => {
  const e = setup(), a = e.link(), b = e.link();
  e.event('focusin', a.element);
  e.event('pointerover', a.element);
  e.event('pointerout', a.element);
  assert.equal(a.element.animations.length, 1);
  assert.ok(a.classes.has('is-link-underlined'), 'keyboard focus survives pointer leave');
  e.event('focusout', a.element, { relatedTarget: b.element });
  assert.equal(a.element.animations[0].playState, 'idle');
  assert.equal(a.classes.size, 0); assert.ok(b.classes.has('is-link-underlined'));
  e.event('focusout', b.element);
  const preview = e.link();
  e.event('pointerover', preview.element);
  e.event('pointerout', preview.element);
  e.event('pointerover', preview.element);
  assert.equal(preview.element.animations.length, 2);
  assert.equal(preview.element.animations[0].playState, 'idle');
  assert.ok(preview.classes.has('is-link-underlined'));
  e.controller.destroy(); assert.equal(preview.classes.size, 0);
});

test('internal links, controls, badges, image links, authored backgrounds and touch hover are not enhanced', () => {
  const e = setup();
  for (const options of [{ external: false }, { excluded: true }, { image: true }, { underlined: false }, { background: 'linear-gradient(red, blue)' }]) {
    const { element, classes } = e.link(options);
    e.event('pointerover', element); e.event('focusin', element);
    assert.equal(element.animations.length, 0); assert.equal(classes.size, 0);
  }
  const { element } = e.link();
  e.event('pointerover', element, { pointerType: 'touch' });
  assert.equal(element.animations.length, 0);
  e.controller.destroy();
});

test('runtime reduced motion, hidden pages and destroy release the underline; reinitialization is clean', () => {
  const e = setup(), { element, classes } = e.link();
  e.event('pointerover', element);
  e.api.media.matches = true; e.api.media.dispatchEvent(new Event('change'));
  assert.equal(element.animations[0].playState, 'idle'); assert.equal(classes.size, 0);
  e.event('focusin', element); assert.equal(element.animations.length, 1);
  e.api.media.matches = false; e.api.media.dispatchEvent(new Event('change'));
  e.event('pointerover', element); assert.equal(element.animations.length, 2);
  e.document.hidden = true; e.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(classes.size, 0); assert.equal(element.animations[1].playState, 'idle');
  e.event('focusin', element); assert.equal(element.animations.length, 2);
  e.document.hidden = false;
  e.controller.destroy(); e.event('pointerover', element); assert.equal(element.animations.length, 2);
  const restored = e.api.initLinkUnderline();
  e.event('pointerover', element); assert.equal(element.animations.length, 3);
  restored.destroy(); assert.equal(classes.size, 0);
});

test('underline styling preserves inline wrapping and native print/high-contrast fallbacks; site owns BFCache lifecycle', async () => {
  const root = await readSiteStyles();
  const rules: string[] = [];
  root.walkRules(rule => { if (rule.selector === 'a.is-link-underlined') rules.push(rule.toString()); });
  assert.match(rules[0], /box-decoration-break: clone/);
  assert.match(rules[0], /background-position: left bottom/);
  assert.doesNotMatch(rules[0], /inline-block|white-space|position:\s*absolute|transition:|animation:/);
  assert.match(rules[1], /text-decoration-color: currentColor/);
  assert.match(rules[1], /background-image: none/);
  const site = await readFile('src/runtime/site.ts', 'utf8');
  assert.match(site, /pagehide[\s\S]*linkUnderline\.destroy\(\)/);
  assert.match(site, /pageshow[\s\S]*event\.persisted[\s\S]*linkUnderline = initLinkUnderline\(\)/);
});
