if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname }).catch((error) => {
      console.warn('[6.am] Offline support could not start.', error);
    });
  });
}

