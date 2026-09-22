import { build } from 'vite';
import { readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { normalizeBase, pages } from './pages.config.js';
import { manifestFor } from './pwa.config.js';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const baseArgument = process.argv.indexOf('--base');
const base = baseArgument >= 0 ? normalizeBase(process.argv[baseArgument + 1] || '/') : undefined;

await build({
  configLoader: 'runner',
  root,
  ...(base ? { base } : {})
});

// Keep public page URLs independent from the source layout.
for (const page of Object.values(pages)) {
  await rename(resolve(output, page.source), resolve(output, page.output));
}
await rm(resolve(output, 'src'), { recursive: true, force: true });

/** @param {string} directory */
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

/** @param {string} path */
function atBase(path) {
  return `${base || '/'}${path.replace(/^\/+/, '')}`;
}

const coreFiles = new Set([
  ...Object.values(pages).flatMap((page) => [page.output, ...page.routes.map((route) => route.slice(1))]),
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'favicon.svg',
  'sounds/soft-chime.wav',
  'sounds/glass-bell.wav',
  'sounds/digital-pulse.wav'
]);

for (const folder of ['assets', 'fonts', 'icons']) {
  for (const file of await filesIn(resolve(output, folder))) coreFiles.add(relative(output, file).replaceAll('\\', '/'));
}

await writeFile(resolve(output, 'manifest.webmanifest'), `${JSON.stringify(manifestFor(base || '/'), null, 2)}\n`);
const precache = [...coreFiles].map(atBase).sort();
const revision = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 12);
const serviceWorker = `const APP_BASE = ${JSON.stringify(base || '/')};
const PRECACHE = ${JSON.stringify(precache)};
const PRECACHE_NAME = '6am-precache-${revision}';
const MEDIA_CACHE_NAME = '6am-media-v1';
const cacheablePaths = new Set(PRECACHE.map((url) => new URL(url, self.location.origin).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('6am-precache-') && key !== PRECACHE_NAME)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function navigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PRECACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(APP_BASE));
  }
}

async function media(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) caches.open(MEDIA_CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') return event.respondWith(navigation(request));
  if (cacheablePaths.has(url.pathname)) return event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  if (url.pathname.startsWith(APP_BASE + 'sounds/ambient/') || url.pathname.startsWith(APP_BASE + 'sounds/lofi/')) return event.respondWith(media(request));
});
`;
await writeFile(resolve(output, 'sw.js'), serviceWorker);
