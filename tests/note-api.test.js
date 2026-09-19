import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiResponse } from '../src/scripts/note-api.js';

test('reads successful JSON API responses', async () => {
  const payload = await readApiResponse(new Response(JSON.stringify({ code: 'abc' }), {
    headers: { 'Content-Type': 'application/json' }
  }), 'Create note');

  assert.equal(payload.code, 'abc');
});

test('reports an empty API response with its status and action', async () => {
  await assert.rejects(
    readApiResponse(new Response(null, { status: 500 }), 'Create note'),
    /Create note: the server returned an empty response \(HTTP 500\)/
  );
});

test('reports non-JSON responses instead of exposing a JSON parse error', async () => {
  await assert.rejects(
    readApiResponse(new Response('<!doctype html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    }), 'Finalize note'),
    /Finalize note: expected JSON but received text\/html \(HTTP 404\)/
  );
});

test('preserves JSON error messages from the API', async () => {
  await assert.rejects(
    readApiResponse(new Response(JSON.stringify({ error: 'This note is unavailable.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }), 'Reveal note'),
    /This note is unavailable\./
  );
});
