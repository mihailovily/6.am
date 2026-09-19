import test from 'node:test';
import assert from 'node:assert/strict';
import { codeFor, expiryAt, validDestination, validLifetime } from '../worker/src/domain.js';
import { assetPathFor } from '../worker/src/page-routes.js';
import { decryptNote, encryptNote, proofFor } from '../src/scripts/note-crypto.js';

test('short-code sequence starts with compact lowercase codes', () => {
  assert.equal(codeFor(0), 'a');
  assert.equal(codeFor(25), 'z');
  assert.equal(codeFor(26), '0');
  assert.equal(codeFor(35), '9');
  assert.equal(codeFor(36), 'aa');
});

test('only the three supported lifetimes are valid', () => {
  assert.equal(validLifetime(24), true);
  assert.equal(validLifetime(72), true);
  assert.equal(validLifetime(168), true);
  assert.equal(validLifetime(48), false);
  assert.equal(expiryAt(10, 24), 86400010);
});

test('short links accept only http and https destinations', () => {
  assert.equal(validDestination('https://example.com/a'), true);
  assert.equal(validDestination('http://localhost:3000'), true);
  assert.equal(validDestination('javascript:alert(1)'), false);
  assert.equal(validDestination('data:text/plain,nope'), false);
});

test('worker maps every clean page URL to its built HTML asset', () => {
  assert.equal(assetPathFor('/'), '/index.html');
  assert.equal(assetPathFor('/time'), '/time.html');
  assert.equal(assetPathFor('/life'), '/life.html');
  assert.equal(assetPathFor('/qr'), '/qr.html');
  assert.equal(assetPathFor('/note'), '/note.html');
  assert.equal(assetPathFor('/qr.html'), '/qr.html');
  assert.equal(assetPathFor('/life.html'), '/life.html');
});

test('notes round-trip through AES-GCM and derive code-specific proofs', async () => {
  const encrypted = await encryptNote('only the recipient can read this');
  assert.equal(await decryptNote(encrypted), 'only the recipient can read this');
  assert.notEqual(await proofFor(encrypted.key, 'a'), await proofFor(encrypted.key, 'b'));
});
