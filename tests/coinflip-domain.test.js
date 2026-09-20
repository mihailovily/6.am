import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSide, classifyGesture, createSession, recordFlip } from '../src/scripts/coinflip-domain.js';

test('each flip requests fresh entropy and hashes it with bounded gesture context', async () => {
  let calls = 0;
  const inputs = [];
  const source = {
    getRandomValues(bytes) { calls++; assert.equal(bytes.length, 32); return bytes.fill(calls); },
    subtle: { async digest(algorithm, bytes) { assert.equal(algorithm, 'SHA-256'); inputs.push(bytes); return new Uint8Array([calls - 1]).buffer; } }
  };
  const context = { number: 1, time: 100, elapsed: 12, samples: Array.from({ length: 100 }, (_, x) => ({ x, y: 0, t: x, pressure: .5 })) };
  assert.equal(await chooseSide(context, source), 'Heads');
  assert.equal(await chooseSide(context, source), 'Tails');
  assert.equal(calls, 2);
  assert.equal(inputs[0][0], 1);
  assert.equal(inputs[1][0], 2);
  const extra = JSON.parse(new TextDecoder().decode(inputs[0].slice(32)));
  assert.equal(extra.samples.length, 64);
  assert.equal(extra.samples[0].x, 36);
  assert.equal(extra.time, 100);
});

test('crypto failures propagate without a weak fallback', async () => {
  const context = { number: 1, time: 0, elapsed: 0, samples: [] };
  await assert.rejects(chooseSide(context, {}), /Secure randomness/);
  await assert.rejects(chooseSide(context, {
    getRandomValues() { throw new Error('Entropy unavailable'); }, subtle: {}
  }), /Entropy unavailable/);
  await assert.rejects(chooseSide(context, {
    getRandomValues(bytes) { return bytes; }, subtle: { digest() { throw new Error('Digest failed'); } }
  }), /Digest failed/);
});

test('session totals outlive the 20-item history and reset completely', () => {
  let session = createSession();
  for (let i = 0; i < 25; i++) session = recordFlip(session, i % 2 ? 'Tails' : 'Heads');
  assert.deepEqual([session.heads, session.tails, session.total], [13, 12, 25]);
  assert.equal(session.history.length, 20);
  assert.deepEqual(session.history[0], { number: 25, side: 'Heads' });
  assert.equal(session.history.at(-1).number, 6);
  session = createSession();
  assert.deepEqual(session, { heads: 0, tails: 0, total: 0, history: [] });
});

test('gestures distinguish taps, upward throws and ignored drags', () => {
  const start = { x: 100, y: 200, t: 0, pressure: .5 };
  const end = (x, y, t = 100) => ({ x, y, t, pressure: 0 });
  assert.equal(classifyGesture(start, end(105, 200)).kind, 'tap');
  assert.equal(classifyGesture(start, end(100, 176)).kind, 'swipe');
  assert.equal(classifyGesture(start, end(100, 250)).kind, 'none');
  assert.equal(classifyGesture(start, end(200, 150)).kind, 'none');
  assert.equal(classifyGesture(start, end(100, 0, 0)).strength, 1);
  assert.ok(classifyGesture(start, end(100, 100, 100)).strength > classifyGesture(start, end(100, 100, 500)).strength);
});
