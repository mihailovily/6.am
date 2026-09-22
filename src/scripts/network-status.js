/** @param {string} fallback */
export function networkFailure(fallback) {
  return navigator.onLine ? fallback : 'You’re offline. Connect to the internet to use this feature.';
}
