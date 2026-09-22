export const pwaAssets = {
  name: '6.am',
  shortName: '6.am',
  themeColor: '#08090b',
  backgroundColor: '#08090b'
};

/** @param {string} base */
export function manifestFor(base) {
  return {
    id: base,
    name: pwaAssets.name,
    short_name: pwaAssets.shortName,
    description: 'A calm set of tools for productive work.',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'any',
    theme_color: pwaAssets.themeColor,
    background_color: pwaAssets.backgroundColor,
    icons: [
      { src: `${base}icons/6am-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/6am-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/6am-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}

