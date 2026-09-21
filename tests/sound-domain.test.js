import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp, defaultSoundscape, effectiveVolume, nextShuffleIndex, normalizeSoundscape, searchSounds } from '../src/scripts/sound-domain.js';

test('normalizes a persisted soundscape without restoring playback state', () => {
  assert.deepEqual(normalizeSoundscape({
    version: 99,
    master: 145,
    fadeSeconds: -5,
    selected: { rain: 72, unknown: 40, birds: -8 },
    lofiMode: 'live',
    lofiVolume: 41,
    lofiEnabled: true
  }, ['rain', 'birds']), {
    version: 1,
    master: 100,
    fadeSeconds: 0,
    selected: { rain: 72, birds: 0 },
    lofiMode: 'live',
    lofiVolume: 41,
    lofiEnabled: true
  });
  assert.deepEqual(normalizeSoundscape(null, ['rain']), defaultSoundscape());
});

test('searches sound name, group, and tags case-insensitively', () => {
  const sounds = [
    { name: 'Soft Wind', group: 'Weather', tags: ['breeze'] },
    { name: 'Coffee Shop', group: 'Places', tags: ['people', 'cafe'] }
  ];
  assert.deepEqual(searchSounds(sounds, 'BREEZE'), [sounds[0]]);
  assert.deepEqual(searchSounds(sounds, 'places'), [sounds[1]]);
  assert.deepEqual(searchSounds(sounds, '  '), sounds);
});

test('computes effective volume and a shuffle index without immediate repeats', () => {
  assert.equal(effectiveVolume(50, 60), 0.3);
  assert.equal(clamp(Number.NaN, 3, 8), 3);
  for (const random of [0, 0.2, 0.99]) assert.notEqual(nextShuffleIndex(8, 3, random), 3);
  assert.equal(nextShuffleIndex(1, 0), 0);
});
