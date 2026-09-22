import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { ambientSounds, lofiTracks, soundGroups } from '../src/scripts/sound-catalog.js';

test('ships the complete soundscape catalog and every referenced local file', async () => {
  assert.equal(ambientSounds.length, 31);
  assert.deepEqual([...new Set(ambientSounds.map(({ group }) => group))], soundGroups);
  assert.equal(new Set(ambientSounds.map(({ id }) => id)).size, 31);
  assert.equal(lofiTracks.length, 8);

  for (const [folder, entries] of [['ambient', ambientSounds], ['lofi', lofiTracks]]) {
    for (const entry of entries) {
      const metadata = await stat(new URL(`../public/sounds/${folder}/${entry.file}`, import.meta.url));
      assert.ok(metadata.isFile() && metadata.size > 1_000, `${entry.file} must be a non-empty audio file`);
      assert.ok(metadata.size < 25 * 1024 * 1024, `${entry.file} must fit the static asset limit`);
    }
  }
});

test('keeps Lofi Girl external and does not ship an embedded YouTube player', async () => {
  const [template, engine] = await Promise.all([
    readFile(new URL('../src/templates/time.pug', import.meta.url), 'utf8'),
    readFile(new URL('../src/scripts/sound-engine.js', import.meta.url), 'utf8')
  ]);
  assert.match(template, /href="https:\/\/www\.youtube\.com\/live\/rFZHOHl-L8A\?si=UifpepfRL8Pp8Nft"/);
  assert.match(template, /target="_blank", rel="noopener noreferrer"/);
  assert.doesNotMatch(template, /youtube-player|youtube-live-wrap/);
  assert.doesNotMatch(engine, /iframe_api|YT\.Player|startLive/);
});
