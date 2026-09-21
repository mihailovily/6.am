export const BADGE_DEFAULTS = {
  template: 'card', name: '', role: '', company: '', link: '',
  background: '#151c22', card: '#dae5eb', ink: '#17232c', lanyard: '#a7bfce',
  zoom: 1, panX: .5, panY: .5, width: 1179, height: 2556, scale: 1, position: .5
};
/** @typedef {typeof BADGE_DEFAULTS} Badge */
/** @param {unknown} raw @returns {Badge} */
export function normalizeBadge(raw) {
  const result = { ...BADGE_DEFAULTS };
  if (!raw || typeof raw !== 'object') return result;
  const source = /** @type {Record<string, unknown>} */ (raw);
  for (const key of /** @type {const} */ (['name', 'role', 'company', 'link'])) {
    if (typeof source[key] === 'string') result[key] = source[key].slice(0, key === 'link' ? 500 : 100);
  }
  result.template = source.template === 'minimal' ? 'minimal' : 'card';
  for (const key of /** @type {const} */ (['background', 'card', 'ink', 'lanyard'])) {
    if (typeof source[key] === 'string' && /^#[0-9a-f]{6}$/i.test(source[key])) result[key] = source[key];
  }
  for (const [key, min, max] of /** @type {const} */ ([['zoom', 1, 3], ['panX', 0, 1], ['panY', 0, 1], ['width', 320, 2160], ['height', 568, 4320], ['scale', .6, 1], ['position', 0, 1]])) {
    const number = Number(source[key]);
    if (source[key] !== undefined && Number.isFinite(number)) result[key] = Math.max(min, Math.min(max, number));
  }
  result.width = Math.round(result.width);
  result.height = Math.round(result.height);
  return result;
}
/** @param {string} link */
export function validBadgeLink(link) {
  if (!link.trim()) return true;
  try { return ['http:', 'https:'].includes(new URL(link).protocol); } catch { return false; }
}
/** @param {number} width @param {number} height @param {Badge} state @param {boolean} presentation */
export function badgeLayout(width, height, state, presentation = false) {
  const top = presentation ? height * .06 : height * .25;
  const available = presentation ? height * .80 : height * .63;
  const cardWidth = Math.min(width * .84, available / 1.52) * (presentation ? 1 : state.scale);
  const cardHeight = cardWidth * 1.42;
  const ribbon = state.template === 'card' ? cardWidth / 12 : 0;
  return { x: (width - cardWidth) / 2, y: top + ribbon + (available - cardHeight - ribbon) * (presentation ? .5 : state.position), width: cardWidth, height: cardHeight };
}

