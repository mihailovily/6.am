import test from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_DEFAULTS, badgeLayout, normalizeBadge, validBadgeLink } from '../src/scripts/badge-domain.js';
import { fitText, drawPhoto } from '../src/scripts/badge-renderer.js';

test('restoring malformed preferences remains bounded and rejects injected colors', () => {
  const state = normalizeBadge({ name: 'Илья Михайлов', width: Infinity, height: -1, scale: 10, panX: -3, background: 'url(https://example.com)', template: 'unknown' });
  assert.equal(state.name, 'Илья Михайлов');
  assert.equal(state.width, 1179);
  assert.equal(state.height, 568);
  assert.equal(state.scale, 1);
  assert.equal(state.panX, 0);
  assert.equal(state.background, BADGE_DEFAULTS.background);
  assert.equal(state.template, 'card');
  assert.deepEqual(normalizeBadge(null), BADGE_DEFAULTS);
});

test('QR accepts only complete web links or no link', () => {
  for (const value of ['', 'https://6.am', 'http://example.com/path?q=1']) assert.equal(validBadgeLink(value), true);
  for (const value of ['javascript:alert(1)', 'data:text/plain,test', '/relative', 'example.com']) assert.equal(validBadgeLink(value), false);
});

test('wallpaper card and ribbon stay within lock-screen guides at every extreme', () => {
  for (const [width, height] of [[320,568], [1179,2556], [2160,568], [320,4320]]) {
    for (const template of ['card', 'minimal']) for (const position of [0,.5,1]) for (const scale of [.6,1]) {
      const state = { ...BADGE_DEFAULTS, template, position, scale };
      const box = badgeLayout(width, height, state);
      const ribbon = template === 'card' ? box.width / 12 : 0;
      assert.ok(box.y - ribbon >= height * .25 - .001);
      assert.ok(box.y + box.height <= height * .88 + .001);
      assert.ok(box.x >= 0 && box.x + box.width <= width);
    }
  }
});

test('presentation ignores wallpaper size and placement', () => {
  assert.deepEqual(badgeLayout(390,844,{...BADGE_DEFAULTS,scale:.6,position:0},true), badgeLayout(390,844,{...BADGE_DEFAULTS,scale:1,position:1},true));
});

test('name wraps at word boundaries, shrinks, and reports impossible content', () => {
  const ctx = { font: '', measureText(text) { return {width: Array.from(text).length * Number.parseFloat(this.font.split(' ')[1]) * .55}; } };
  const fitted = fitText(ctx, 'Илья Михайлов', 512, 72, 2);
  assert.deepEqual(fitted.rows, ['Илья', 'Михайлов']);
  assert.equal(fitted.overflow, false);
  assert.equal(fitText(ctx, 'W'.repeat(100), 340, 28, 1).overflow, true);
});

test('photo cropping covers the target and pan endpoints stay inside the image', () => {
  for (const image of [{width:1600,height:800}, {width:800,height:1600}]) {
    for (const zoom of [1,3]) for (const pan of [0,.5,1]) {
      let args;
      drawPhoto({drawImage(...values) { args = values; }}, image, {...BADGE_DEFAULTS,zoom,panX:pan,panY:pan}, 0,0,600,480);
      const [,x,y,w,h,,,dw,dh] = args;
      assert.ok(x >= 0 && y >= 0 && x+w <= image.width+.001 && y+h <= image.height+.001);
      assert.equal(dw,600); assert.equal(dh,480);
    }
  }
});
