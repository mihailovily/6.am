import { Resvg } from '@cf-wasm/resvg/workerd';
import { buildWallpaperSvg, canonicalWallpaperParams, parseWallpaperRequest, wallpaperCacheKey } from '../../src/scripts/life-domain.js';

interface AssetFetcher { fetch(request: Request): Promise<Response>; }
interface LifeEnv { ASSETS: AssetFetcher; }

let fontPromise: Promise<Uint8Array> | null = null;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function fontBytes(request: Request, env: LifeEnv) {
  if (!fontPromise) {
    const url = new URL('/fonts/Geist-Variable.woff2', request.url);
    fontPromise = env.ASSETS.fetch(new Request(url)).then(async (response) => {
      if (!response.ok) throw new Error('Wallpaper font is unavailable.');
      return new Uint8Array(await response.arrayBuffer());
    });
  }
  return fontPromise;
}

async function etagFor(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `"${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}"`;
}

function publicHeaders(length: number, etag: string) {
  return new Headers({
    'Cache-Control': 'no-cache, max-age=0, must-revalidate',
    'Content-Disposition': 'inline; filename="6am-life-wallpaper.png"',
    'Content-Length': String(length),
    'Content-Type': 'image/png',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff'
  });
}

export async function lifeWallpaper(request: Request, env: LifeEnv) {
  const parsed = parseWallpaperRequest(new URL(request.url));
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const config = parsed.value;
  const cacheIdentity = wallpaperCacheKey(config);
  const etag = await etagFor(cacheIdentity);
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: publicHeaders(0, etag) });

  const cacheUrl = new URL('/__life-cache', request.url);
  cacheUrl.search = cacheIdentity;
  const cacheRequest = new Request(cacheUrl, { method: 'GET' });
  const edgeCache = (globalThis.caches as CacheStorage & { default?: Cache }).default;
  let bytes: Uint8Array | null = null;
  const cached = edgeCache ? await edgeCache.match(cacheRequest) : undefined;
  if (cached) bytes = new Uint8Array(await cached.arrayBuffer());

  if (!bytes) {
    const font = await fontBytes(request, env);
    const svg = buildWallpaperSvg(config);
    const renderer = await Resvg.async(svg, {
      font: { loadSystemFonts: false, fontBuffers: [font], defaultFontFamily: 'Geist' },
      shapeRendering: 2,
      textRendering: 2
    });
    bytes = renderer.render().asPng();
    if (edgeCache) {
      const cacheHeaders = new Headers({ 'Cache-Control': 'public, max-age=172800', 'Content-Type': 'image/png' });
      await edgeCache.put(cacheRequest, new Response(bytes.slice(), { headers: cacheHeaders }));
    }
  }

  const headers = publicHeaders(bytes.byteLength, etag);
  if (request.method === 'HEAD') return new Response(null, { headers });
  return new Response(bytes, { headers });
}

export function canonicalLifeUrl(request: Request) {
  const parsed = parseWallpaperRequest(new URL(request.url));
  if (!parsed.ok) return null;
  const url = new URL('/api/v1/life/wallpaper.png', request.url);
  url.search = canonicalWallpaperParams(parsed.value).toString();
  return url;
}
