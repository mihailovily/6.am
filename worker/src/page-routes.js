export const cleanPageRoutes = {
  '/time': '/time.html',
  '/life': '/life.html',
  '/qr': '/qr.html',
  '/note': '/note.html',
  '/note-admin': '/note-admin.html',
  '/note-view': '/note-view.html'
};

export function assetPathFor(pathname) {
  if (pathname === '/') return '/index.html';
  return cleanPageRoutes[pathname] ?? pathname;
}
