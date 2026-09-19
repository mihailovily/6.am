import { resolve } from 'node:path';

export const pages = {
  home: { source: 'src/pages/index.html', output: 'index.html', routes: ['/', '/index.html'] },
  qr: { source: 'src/pages/qr.html', output: 'qr.html', routes: ['/qr', '/qr.html'] },
  time: { source: 'src/pages/time.html', output: 'time.html', routes: ['/time', '/time.html'] },
  life: { source: 'src/pages/life.html', output: 'life.html', routes: ['/life', '/life.html'] },
  note: { source: 'src/pages/note.html', output: 'note.html', routes: ['/note', '/note.html'] },
  noteAdmin: { source: 'src/pages/note-admin.html', output: 'note-admin.html', routes: ['/note-admin', '/note-admin.html'] },
  noteView: { source: 'src/pages/note-view.html', output: 'note-view.html', routes: ['/note-view', '/note-view.html'] }
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
