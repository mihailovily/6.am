import { resolve } from 'node:path';

export const pages = {
  home: { source: 'src/pages/index.html', output: 'index.html', routes: ['/', '/index.html'] },
  time: { source: 'src/pages/time.html', output: 'time.html', routes: ['/time.html'] }
};

/** @param {string} root */
export function pageInputs(root) {
  return Object.fromEntries(Object.entries(pages).map(([name, page]) => [name, resolve(root, page.source)]));
}

/** @param {string} value */
export function normalizeBase(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}
