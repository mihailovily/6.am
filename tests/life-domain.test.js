import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Resvg } from '@cf-wasm/resvg/node';
import {
  DEFAULT_LIFE_COLORS,
  LIFE_WEEKS,
  buildWallpaperSvg,
  canonicalWallpaperParams,
  escapeXml,
  goalProgress,
  lifeProgress,
  localDate,
  mixHexColors,
  normalizeLifeSettings,
  parseIsoDate,
  parseWallpaperRequest,
  wallpaperCacheKey,
  yearProgress
} from '../src/scripts/life-domain.js';

test('life calendar uses 90 rows of 52 weeks and clamps after the horizon', () => {
  const birthday = parseIsoDate('1990-01-01');
  const early = lifeProgress(parseIsoDate('1990-01-08'), birthday);
  assert.equal(LIFE_WEEKS, 4680);
  assert.equal(early.past, 1);
  assert.equal(early.current, 1);
  const late = lifeProgress(parseIsoDate('2100-01-01'), birthday);
  assert.equal(late.past, LIFE_WEEKS);
  assert.equal(late.current, -1);
  assert.equal(late.percent, 100);
});

test('year calendar handles leap years and keeps the current day separate', () => {
  const leapDay = yearProgress(parseIsoDate('2024-02-29'));
  assert.equal(leapDay.total, 366);
  assert.equal(leapDay.current, 59);
  assert.equal(leapDay.past, 59);
  assert.equal(leapDay.remaining, 306);
  assert.equal(yearProgress(parseIsoDate('2025-12-31')).remaining, 0);
});

test('local date follows IANA zone boundaries including a DST weekend', () => {
  assert.equal(localDate(new Date('2026-03-08T04:30:00Z'), 'America/New_York').iso, '2026-03-07');
  assert.equal(localDate(new Date('2026-03-08T07:30:00Z'), 'America/New_York').iso, '2026-03-08');
  assert.equal(localDate(new Date('2026-01-01T00:30:00Z'), 'America/Los_Angeles').iso, '2025-12-31');
  assert.equal(localDate(new Date(), 'Not/A_Zone'), null);
});

test('goal ranges are inclusive before, during, and after progress', () => {
  const start = parseIsoDate('2026-01-10');
  const deadline = parseIsoDate('2026-01-12');
  assert.deepEqual(goalProgress(parseIsoDate('2026-01-09'), start, deadline), { total: 3, past: 0, current: -1, remaining: 3, percent: 0 });
  const active = goalProgress(parseIsoDate('2026-01-11'), start, deadline);
  assert.deepEqual({ ...active, percent: Math.round(active.percent * 1000) / 1000 }, { total: 3, past: 1, current: 1, remaining: 1, percent: 33.333 });
  assert.deepEqual(goalProgress(parseIsoDate('2026-01-13'), start, deadline), { total: 3, past: 3, current: -1, remaining: 0, percent: 100 });
  assert.equal(goalProgress(start, start, start).total, 1);
  assert.throws(() => goalProgress(start, start, parseIsoDate('2037-01-01')), /3660/);
});

test('wallpaper request validates dimensions, dates, title, and timezone', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  const valid = parseWallpaperRequest('https://6.am/api/v1/life/wallpaper.png?calendar=goal&width=1080&height=2400&tz=Europe%2FMoscow&title=Ship&start=2026-09-01&deadline=2026-12-01', now);
  assert.equal(valid.ok, true);
  assert.deepEqual(parseWallpaperRequest('https://6.am/x?calendar=nope&width=1080&height=2400&tz=UTC', now), { ok: false, status: 404, error: 'Unknown calendar.' });
  assert.match(parseWallpaperRequest('https://6.am/x?calendar=days&width=3000&height=4000&tz=UTC', now).error, /Width/);
  assert.match(parseWallpaperRequest('https://6.am/x?calendar=life&width=1080&height=2400&tz=UTC&birthday=2027-01-01', now).error, /future/);
  assert.match(parseWallpaperRequest(`https://6.am/x?calendar=goal&width=1080&height=2400&tz=UTC&title=${'x'.repeat(81)}&start=2026-01-01&deadline=2026-02-01`, now).error, /80/);
  assert.match(parseWallpaperRequest('https://6.am/x?calendar=days&width=1080&height=2400&tz=Wrong%2FZone', now).error, /IANA/);
  assert.match(parseWallpaperRequest('https://6.am/x?calendar=days&width=1080&height=2400&tz=UTC&current=orange', now).error, /six-digit/);
  assert.match(parseWallpaperRequest('https://6.am/x?calendar=days&width=1080&height=2400&tz=UTC&background=%23ffffff', now).error, /without #/);
});

test('wallpaper colors are backward compatible, normalized, and canonical', () => {
  const defaults = parseWallpaperRequest('https://6.am/x?calendar=days&width=1080&height=2400&tz=UTC');
  assert.equal(defaults.ok, true);
  assert.deepEqual(defaults.value.colors, DEFAULT_LIFE_COLORS);

  const custom = parseWallpaperRequest('https://6.am/x?calendar=days&width=1080&height=2400&tz=UTC&current=F29A4A&background=0D0907');
  assert.equal(custom.ok, true);
  assert.deepEqual(custom.value.colors, { ...DEFAULT_LIFE_COLORS, background: '0d0907', current: 'f29a4a' });
  const canonical = canonicalWallpaperParams(custom.value);
  assert.equal(canonical.get('background'), '0d0907');
  assert.equal(canonical.get('past'), DEFAULT_LIFE_COLORS.past);
  assert.equal(canonical.get('current'), 'f29a4a');
});

test('stored Life settings normalize invalid data without throwing', () => {
  const fallback = normalizeLifeSettings(null, 'Europe/Moscow');
  assert.equal(fallback.timeZone, 'Europe/Moscow');
  assert.equal(fallback.palette, 'blue');
  assert.deepEqual(fallback.colors, DEFAULT_LIFE_COLORS);

  const custom = normalizeLifeSettings({
    timeZone: 'America/New_York',
    palette: 'unknown',
    colors: { background: '101010', past: 'EEEEEE', future: '303030', current: '00AA77' }
  }, 'UTC');
  assert.equal(custom.timeZone, 'America/New_York');
  assert.equal(custom.palette, 'custom');
  assert.deepEqual(custom.colors, { background: '101010', past: 'eeeeee', future: '303030', current: '00aa77' });

  const corrupt = normalizeLifeSettings({ timeZone: 'Wrong/Zone', colors: { background: 'bad' } }, 'UTC');
  assert.equal(corrupt.timeZone, 'UTC');
  assert.deepEqual(corrupt.colors, DEFAULT_LIFE_COLORS);
});

test('SVG escapes goal titles and cache identity changes with the local date', () => {
  const first = parseWallpaperRequest('https://6.am/x?calendar=goal&width=320&height=568&tz=UTC&title=%3Cscript%3E%26&start=2026-09-01&deadline=2026-10-01', new Date('2026-09-19T12:00:00Z'));
  const second = parseWallpaperRequest('https://6.am/x?calendar=goal&width=320&height=568&tz=UTC&title=%3Cscript%3E%26&start=2026-09-01&deadline=2026-10-01', new Date('2026-09-20T12:00:00Z'));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(escapeXml('<script>&'), '&lt;script&gt;&amp;');
  const svg = buildWallpaperSvg(first.value);
  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.notEqual(wallpaperCacheKey(first.value), wallpaperCacheKey(second.value));
});

test('SVG and cache identity use the selected palette', () => {
  const base = 'https://6.am/x?calendar=days&width=320&height=568&tz=UTC';
  const standard = parseWallpaperRequest(base, new Date('2026-09-19T12:00:00Z'));
  const ember = parseWallpaperRequest(`${base}&background=0d0907&past=f3ede7&future=46352b&current=f29a4a`, new Date('2026-09-19T12:00:00Z'));
  assert.equal(standard.ok, true);
  assert.equal(ember.ok, true);
  const svg = buildWallpaperSvg(ember.value);
  assert.match(svg, /fill="#0d0907"/);
  assert.match(svg, /fill="#f3ede7"/);
  assert.match(svg, /fill="#46352b"/);
  assert.match(svg, /fill="#f29a4a"/);
  assert.match(svg, new RegExp(`fill="#${mixHexColors('0d0907', 'f3ede7', 0.65)}"`));
  assert.notEqual(wallpaperCacheKey(standard.value), wallpaperCacheKey(ember.value));
});

test('renderer creates a PNG with the requested IHDR dimensions', async () => {
  const parsed = parseWallpaperRequest('https://6.am/x?calendar=days&width=320&height=568&tz=UTC', new Date('2026-09-19T12:00:00Z'));
  assert.equal(parsed.ok, true);
  const font = new Uint8Array(await readFile('public/fonts/Geist-Variable.woff2'));
  const renderer = await Resvg.async(buildWallpaperSvg(parsed.value), { font: { loadSystemFonts: false, fontBuffers: [font], defaultFontFamily: 'Geist' } });
  const png = renderer.render().asPng();
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assert.equal(view.getUint32(16), 320);
  assert.equal(view.getUint32(20), 568);
});
