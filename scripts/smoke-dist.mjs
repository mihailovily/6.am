import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { normalizeBase, pages } from '../pages.config.js';

const root = resolve('dist');
const baseArgument = process.argv.indexOf('--base');
const base = normalizeBase(baseArgument >= 0 ? process.argv[baseArgument + 1] || '/' : '/');
const pagePaths = Object.values(pages).map((page) => `/${page.output}`);
const contentTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2']
]);

function fileForUrl(pathname) {
  let pathWithoutBase = pathname;
  if (base !== '/') {
    if (pathname === base.slice(0, -1)) pathWithoutBase = '/';
    else if (pathname.startsWith(base)) pathWithoutBase = `/${pathname.slice(base.length)}`;
    else throw new Error(`Path is outside configured base ${base}: ${pathname}`);
  }
  const relativePath = decodeURIComponent(pathWithoutBase === '/' ? '/index.html' : pathWithoutBase)
    .replace(/^\/+/, '')
    .replaceAll('/', sep);
  const file = resolve(root, relativePath);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    throw new Error(`Path escapes dist: ${pathname}`);
  }
  return file;
}

function expectedContentType(pathname) {
  const file = fileForUrl(pathname);
  const expected = contentTypes.get(extname(file));
  if (!expected) throw new Error(`No expected MIME type configured for ${pathname}`);
  return expected;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = fileForUrl(pathname);
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error('Not a file');
    response.setHeader('Content-Type', expectedContentType(pathname));
    createReadStream(file).pipe(response);
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
});

server.listen(0, '127.0.0.1');
await new Promise((resolveListening) => server.once('listening', resolveListening));

try {
  const { port } = server.address();
  const assets = new Set(pagePaths.map((page) => `${base}${page.replace(/^\//, '')}`));

  for (const page of assets) {
    if (expectedContentType(page) !== 'text/html') continue;
    const html = await readFile(fileForUrl(page), 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      const reference = match[1];
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(reference)) continue;
      assets.add(new URL(reference, `http://localhost${page}`).pathname);
    }
  }

  for (const pathname of assets) {
    await access(fileForUrl(pathname));
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`);

    const actual = response.headers.get('content-type')?.split(';', 1)[0];
    const expected = expectedContentType(pathname);
    if (actual !== expected) {
      throw new Error(`${pathname} returned ${actual ?? 'no Content-Type'}, expected ${expected}`);
    }
  }

  console.log(`Smoke check passed at ${base}: ${pagePaths.length} pages, ${assets.size - pagePaths.length} local references.`);
} finally {
  server.close();
}
