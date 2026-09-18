import { codeFor, expiryAt, validDestination, validLifetime } from './domain.js';
import { verifyAccessIdentity } from './auth.js';

interface D1Result<T> { results?: T[]; }
interface D1Statement { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T | null>; run(): Promise<unknown>; }
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown>; }
interface Env { ASSETS: Fetcher; DB: D1Database; TURNSTILE_SECRET_KEY?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ALLOW_UNVERIFIED_TURNSTILE?: string; ALLOW_UNVERIFIED_ACCESS?: string; }
interface Resource { kind: 'link' | 'note'; target_url: string | null; ciphertext: string | null; nonce: string | null; single_use: number; }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (error: string, status = 400) => json({ error }, status);

function routeAsset(request: Request, env: Env) {
  const url = new URL(request.url);
  // `html_handling: none` preserves the explicit `.html` routes, so map the site root ourselves.
  if (url.pathname === '/') url.pathname = '/index.html';
  return env.ASSETS.fetch(new Request(url, request));
}

async function body(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

async function nextCode(db: D1Database) {
  const row = await db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'short-code' RETURNING value").first<{ value: number }>();
  if (!row) throw new Error('Short-code counter is unavailable.');
  return codeFor(row.value - 1);
}

async function createPrincipal(db: D1Database, issuer: string, subject: string) {
  const existing = await db.prepare('SELECT principal_id FROM identity_links WHERE issuer = ? AND subject = ?').bind(issuer, subject).first<{ principal_id: string }>();
  if (existing) return existing.principal_id;
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO principals (id, created_at) VALUES (?, ?)').bind(id, now),
    db.prepare('INSERT INTO identity_links (issuer, subject, principal_id, created_at) VALUES (?, ?, ?, ?)').bind(issuer, subject, id, now)
  ]);
  return id;
}

async function validTurnstile(token: unknown, request: Request, env: Env) {
  if (env.ALLOW_UNVERIFIED_TURNSTILE === 'true') return true;
  if (!env.TURNSTILE_SECRET_KEY || typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  return response.ok && Boolean((await response.json() as { success?: boolean }).success);
}

async function createNote(request: Request, env: Env) {
  const payload = await body(request);
  if (!payload) return failure('Expected JSON request body.');
  const { ciphertext, nonce, expiresInHours, singleUse, turnstileToken } = payload;
  if (typeof ciphertext !== 'string' || ciphertext.length === 0 || ciphertext.length > 24000 || typeof nonce !== 'string' || nonce.length > 128) return failure('Invalid encrypted note.');
  if (typeof expiresInHours !== 'number' || !validLifetime(expiresInHours)) return failure('Choose a supported lifetime.');
  if (!await validTurnstile(turnstileToken, request, env)) return failure('Human verification failed.', 403);
  const code = await nextCode(env.DB);
  const now = Date.now();
  const creationToken = crypto.randomUUID();
  // The browser computes the proof after the code is known, so it is patched immediately by a second request.
  // A record without proof is never readable and is deleted by the expiration cron if abandoned.
  await env.DB.prepare('INSERT INTO resources (code, kind, ciphertext, nonce, proof, creation_token, single_use, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(code, 'note', ciphertext, nonce, 'pending', creationToken, singleUse ? 1 : 0, expiryAt(now, expiresInHours), now).run();
  return json({ code, creationToken }, 201);
}

async function attachNoteProof(request: Request, env: Env, code: string) {
  const payload = await body(request);
  if (!payload || typeof payload.proof !== 'string' || payload.proof.length < 20 || payload.proof.length > 128 || typeof payload.creationToken !== 'string') return failure('Invalid note proof.');
  const now = Date.now();
  const result = await env.DB.prepare("UPDATE resources SET proof = ? WHERE code = ? AND kind = 'note' AND proof = 'pending' AND creation_token = ? AND expires_at > ?").bind(payload.proof, code, payload.creationToken, now).run() as { meta?: { changes?: number } };
  return result.meta?.changes ? json({ ok: true }) : failure('This note is unavailable.', 404);
}

async function revealNote(request: Request, env: Env, code: string) {
  const payload = await body(request);
  if (!payload || typeof payload.proof !== 'string') return failure('A valid note key is required.', 403);
  const now = Date.now();
  const oneTime = await env.DB.prepare("DELETE FROM resources WHERE code = ? AND kind = 'note' AND single_use = 1 AND proof = ? AND expires_at > ? RETURNING ciphertext, nonce, single_use").bind(code, payload.proof, now).first<Resource>();
  if (oneTime) return json({ ciphertext: oneTime.ciphertext, nonce: oneTime.nonce, singleUse: true });
  const resource = await env.DB.prepare("SELECT ciphertext, nonce, single_use FROM resources WHERE code = ? AND kind = 'note' AND proof = ? AND expires_at > ?").bind(code, payload.proof, now).first<Resource>();
  if (!resource) return failure('This note is unavailable.', 404);
  return json({ ciphertext: resource.ciphertext, nonce: resource.nonce, singleUse: false });
}

async function createLink(request: Request, env: Env) {
  const identity = env.ALLOW_UNVERIFIED_ACCESS === 'true'
    ? { issuer: 'local-development', subject: 'owner' }
    : await verifyAccessIdentity(request, env).catch(() => null);
  if (!identity) return failure('Owner authentication is required.', 401);
  const payload = await body(request);
  if (!payload || typeof payload.url !== 'string' || !validDestination(payload.url)) return failure('Use a valid http or https URL.');
  if (typeof payload.expiresInHours !== 'number' || !validLifetime(payload.expiresInHours)) return failure('Choose a supported lifetime.');
  const principalId = await createPrincipal(env.DB, identity.issuer, identity.subject);
  const code = await nextCode(env.DB);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO resources (code, kind, target_url, single_use, expires_at, principal_id, created_at) VALUES (?, ?, ?, 0, ?, ?, ?)').bind(code, 'link', payload.url, expiryAt(now, payload.expiresInHours), principalId, now).run();
  return json({ code }, 201);
}

async function resolveShort(request: Request, env: Env, code: string) {
  const resource = await env.DB.prepare('SELECT kind, target_url FROM resources WHERE code = ? AND expires_at > ?').bind(code, Date.now()).first<Resource>();
  if (!resource) return new Response('This resource is unavailable.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (resource.kind === 'link' && resource.target_url) return Response.redirect(resource.target_url, 302);
  const url = new URL(request.url);
  url.pathname = '/note-view.html';
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (request.method === 'POST' && pathname === '/api/v1/notes') return await createNote(request, env);
      const proofMatch = pathname.match(/^\/api\/v1\/notes\/([a-z0-9]+)\/proof$/);
      if (request.method === 'POST' && proofMatch) return await attachNoteProof(request, env, proofMatch[1]);
      const revealMatch = pathname.match(/^\/api\/v1\/notes\/([a-z0-9]+)\/reveal$/);
      if (request.method === 'POST' && revealMatch) return await revealNote(request, env, revealMatch[1]);
      if (request.method === 'POST' && pathname === '/api/v1/admin/links') return await createLink(request, env);
      const shortMatch = pathname.match(/^\/shrt\/([a-z0-9]+)$/);
      if (request.method === 'GET' && shortMatch) return await resolveShort(request, env, shortMatch[1]);
      if (request.method === 'GET') return await routeAsset(request, env);
      return failure('Not found.', 404);
    } catch (error) {
      console.error('[6.am worker] request failed', {
        method: request.method,
        pathname,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return failure('The server could not complete this request.', 500);
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await env.DB.prepare('DELETE FROM resources WHERE expires_at <= ?').bind(Date.now()).run();
  }
};
