import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advancePomodoro,
  buildTimeZones,
  createDefaults,
  createRuntime,
  elapsed,
  normalizeRuntime,
  normalizeSettings,
  runtimeSnapshot,
  saveJson
} from '../src/scripts/time-domain.js';

const settings = createDefaults('Europe/Moscow');
const now = 2_000_000_000_000;

test('restores running pomodoro from its absolute deadline', () => {
  const runtime = createRuntime(settings);
  runtime.pomodoro.deadline = now + 42_000;
  runtime.pomodoro.remaining = 60_000;
  const restored = normalizeRuntime(runtimeSnapshot(runtime, now - 1_000), settings, now);
  assert.equal(restored.restored, true);
  assert.equal(restored.runtime.pomodoro.remaining, 42_000);
  assert.equal(restored.runtime.pomodoro.deadline, now + 42_000);
});

test('catches up an expired pomodoro and pauses when auto-start is off', () => {
  const runtime = createRuntime(settings);
  runtime.pomodoro.deadline = now - 1;
  const restored = normalizeRuntime(runtimeSnapshot(runtime, now - 10_000), settings, now);
  assert.equal(restored.transitions, 1);
  assert.equal(restored.runtime.pomodoro.phase, 'short');
  assert.equal(restored.runtime.pomodoro.deadline, null);
  assert.equal(restored.runtime.pomodoro.completed, 1);
});

test('catches up multiple phases when auto-start is on', () => {
  const fast = { ...settings, focus: 1, short: 1, long: 1, autoStart: true };
  const runtime = createRuntime(fast);
  runtime.pomodoro.deadline = now - 90_000;
  const advanced = advancePomodoro(runtime.pomodoro, fast, now);
  assert.equal(advanced.transitions, 2);
  assert.equal(advanced.timer.phase, 'focus');
  assert.equal(advanced.timer.completed, 1);
  assert.equal(advanced.timer.remaining, 30_000);
});

test('restores a running stopwatch and its laps', () => {
  const runtime = createRuntime(settings);
  runtime.stopwatch = { accumulated: 5_000, startedAt: now - 10_000, laps: [7_000, 12_000] };
  const restored = normalizeRuntime(runtimeSnapshot(runtime, now - 1_000), settings, now);
  assert.equal(restored.restored, true);
  assert.equal(elapsed(restored.runtime.stopwatch, now), 15_000);
  assert.deepEqual(restored.runtime.stopwatch.laps, [7_000, 12_000]);
});

test('rejects damaged, future and obsolete runtime snapshots', () => {
  const runtime = createRuntime(settings);
  const damaged = { ...runtimeSnapshot(runtime, now), version: 999 };
  assert.equal(normalizeRuntime(damaged, settings, now).restored, false);
  assert.equal(normalizeRuntime({ ...runtimeSnapshot(runtime, now), savedAt: now + 600_000 }, settings, now).restored, false);
  assert.equal(normalizeRuntime({ ...runtimeSnapshot(runtime, now), savedAt: 0 }, settings, now).restored, false);
  const impossibleDeadline = runtimeSnapshot(runtime, now);
  impossibleDeadline.pomodoro.deadline = 0;
  assert.equal(normalizeRuntime(impossibleDeadline, settings, now).restored, false);
});

test('migrates valid older settings and rejects invalid values', () => {
  const migrated = normalizeSettings({ focus: 30, short: 7, long: 20, cycles: 3, sound: false, autoStart: true }, 'UTC');
  assert.equal(migrated.focus, 30);
  assert.equal(migrated.clockFormat24, true);
  assert.equal(normalizeSettings({ focus: 0 }, 'UTC').focus, 25);
});

test('reports storage write failures', () => {
  assert.equal(saveJson({ setItem() {} }, 'key', { ok: true }), true);
  assert.equal(saveJson({ setItem() { throw new Error('quota'); } }, 'key', { ok: true }), false);
});

test('timezone fallback remains useful without supportedValuesOf', () => {
  const zones = buildTimeZones([], 'Pacific/Auckland');
  assert.ok(zones.includes('Europe/London'));
  assert.ok(zones.includes('America/New_York'));
  assert.ok(zones.includes('Asia/Tokyo'));
  assert.ok(zones.includes('Pacific/Auckland'));
});
