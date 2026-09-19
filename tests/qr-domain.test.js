import assert from 'node:assert/strict';
import test from 'node:test';
import { isOpenableUrl, loadSettings, normalizeSettings, saveSettings, validateContent, writerOptions } from '../src/scripts/qr-domain.js';

test('normalizes persisted QR settings without retaining content', () => {
  const settings = normalizeSettings({ format: 'QRCode', size: 9000, errorLevel: 'H', version: '4', mask: '2', quietZone: 'false', dark: '#123456', light: '#abcdef', content: 'private' });
  assert.deepEqual(settings, { format: 'QRCode', size: 4096, errorLevel: 'H', version: '4', mask: '2', quietZone: 'false', dark: '#123456', light: '#abcdef' });
});

test('validates retail and linear barcode requirements', () => {
  assert.equal(validateContent('EAN13', '4006381333931'), '');
  assert.match(validateContent('EAN13', '4006381333932'), /valid check digit/);
  assert.equal(validateContent('UPCA', '036000291452'), '');
  assert.match(validateContent('ITF', '123'), /even number/);
  assert.match(validateContent('Code39', 'lowercase'), /uppercase/);
});

test('converts QR controls to ZXing options', () => {
  assert.deepEqual(writerOptions(normalizeSettings({ format: 'QRCode', errorLevel: 'Q', version: '7', mask: '3', quietZone: 'false' })), { format: 'QRCode', sizeHint: 512, options: 'ecLevel=Q,version=7,dataMask=3', addQuietZones: false });
  assert.equal(writerOptions(normalizeSettings({ format: 'Aztec' })).options, '');
});

test('persists only normalized settings and handles unavailable storage', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveSettings(storage, { format: 'Code128', size: 640 }), true);
  assert.deepEqual(loadSettings(storage), normalizeSettings({ format: 'Code128', size: 640 }));
  assert.equal(saveSettings({ setItem() { throw new Error('quota'); } }, {}), false);
});

test('only HTTP URLs are openable reader results', () => {
  assert.equal(isOpenableUrl('https://6am.milya.site/qr'), true);
  assert.equal(isOpenableUrl('javascript:alert(1)'), false);
  assert.equal(isOpenableUrl('not a url'), false);
});
