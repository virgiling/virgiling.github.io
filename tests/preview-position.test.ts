import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { computePosition, platform, type Rect } from '@floating-ui/dom';
import { previewPositionOptions } from '../src/runtime/preview-position';

// Real Floating UI middleware with measured-geometry fixtures, not browser layout.
async function position(reference: Rect, floating: Rect, viewport: Rect) {
  const { document } = parseHTML('<a id="reference"></a><div id="floating"></div>');
  const anchor = document.querySelector<HTMLElement>('#reference')!;
  const popover = document.querySelector<HTMLElement>('#floating')!;
  const dimensions = () => ({ ...floating, height: Math.min(floating.height, Number.parseFloat(popover.style.maxHeight) || Infinity) });
  const result = await computePosition(anchor, popover, {
    ...previewPositionOptions,
    platform: {
      ...platform,
      getElementRects: () => ({ reference, floating: dimensions() }),
      getClippingRect: () => viewport,
      getDimensions: dimensions,
      getOffsetParent: () => popover,
      getDocumentElement: () => popover,
      convertOffsetParentRelativeRectToViewportRelativeRect: ({ rect }) => rect,
      isRTL: () => false,
      isElement: () => false,
    },
  });
  return { ...result, height: dimensions().height };
}

test('preview follows the link down and right when there is room', async () => {
  const result = await position({ x: 100, y: 100, width: 90, height: 20 }, { x: 0, y: 0, width: 600, height: 434 }, { x: 0, y: 0, width: 1200, height: 900 });
  assert.equal(result.x, 100);
  assert.equal(result.y, 130);
  assert.equal(result.placement, 'bottom-start');
  assert.equal(result.strategy, 'fixed');
});

test('insufficient space must not flip the toolbar above the visible viewport', async () => {
  const result = await position({ x: 180, y: 400, width: 90, height: 20 }, { x: 0, y: 0, width: 600, height: 434 }, { x: 0, y: 0, width: 1200, height: 600 });
  assert.ok(result.y >= 14, `toolbar starts at ${result.y}px, outside the visible viewport`);
  assert.equal(result.y, 430, 'shrink the reading area below the link instead of covering the native click target');
  assert.equal(result.height, 156);
  assert.ok(result.y + result.height <= 600 - 14);
  assert.equal(result.placement, 'bottom-start');
});

test('edge links and resized narrow viewports retain a visible toolbar and scroll area', async () => {
  const cases = [
    { width: 1200, height: 600, x: 1140, y: 570, placement: 'top-start' },
    { width: 360, height: 600, x: 320, y: 300, placement: 'bottom-start' },
    { width: 320, height: 400, x: 280, y: 360, placement: 'top-start' },
  ];
  for (const { width, height, x, y, placement } of cases) {
    const floating = { x: 0, y: 0, width: Math.min(600, width - 28), height: Math.min(height * .65 + 44, height - 28) };
    const result = await position({ x, y, width: 35, height: 20 }, floating, { x: 0, y: 0, width, height });
    assert.equal(result.placement, placement);
    assert.ok(result.x >= 14 && result.x + floating.width <= width - 14);
    assert.ok(result.y >= 14 && result.y + result.height <= height - 14);
    assert.ok(result.y >= y + 30 || result.y + result.height <= y - 10, 'edge fallback must not cover the trigger link');
  }
});
