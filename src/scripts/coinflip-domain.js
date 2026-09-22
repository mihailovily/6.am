/** @typedef {'Heads' | 'Tails'} Side */
/** @typedef {{x: number, y: number, t: number, pressure: number}} Sample */
/** @typedef {{heads: number, tails: number, total: number, history: {number: number, side: Side}[]}} Session */

/** @returns {Session} */
export function createSession() {
  return { heads: 0, tails: 0, total: 0, history: [] };
}

/** @param {Session} session @param {Side} side @returns {Session} */
export function recordFlip(session, side) {
  const total = session.total + 1;
  return {
    heads: session.heads + Number(side === 'Heads'),
    tails: session.tails + Number(side === 'Tails'),
    total,
    history: [{ number: total, side }, ...session.history].slice(0, 20)
  };
}

/** Fresh browser entropy is the source; gesture and timing are supplemental inputs.
 * @param {{number: number, time: number, elapsed: number, samples: Sample[]}} context
 * @param {Pick<Crypto, 'getRandomValues' | 'subtle'>} [cryptoSource]
 * @returns {Promise<Side>}
 */
export async function chooseSide(context, cryptoSource = globalThis.crypto) {
  if (!cryptoSource?.getRandomValues || !cryptoSource.subtle) {
    throw new Error('Secure randomness is unavailable. Open this page over HTTPS and try again.');
  }
  const entropy = cryptoSource.getRandomValues(new Uint8Array(32));
  const extra = new TextEncoder().encode(JSON.stringify({ ...context, samples: context.samples.slice(-64) }));
  const input = new Uint8Array(entropy.length + extra.length);
  input.set(entropy);
  input.set(extra, entropy.length);
  const digest = new Uint8Array(await cryptoSource.subtle.digest('SHA-256', input));
  return (digest[0] & 1) === 0 ? 'Heads' : 'Tails';
}

/** @param {Sample} start @param {Sample} end */
export function classifyGesture(start, end) {
  const dx = end.x - start.x;
  const up = start.y - end.y;
  if (up >= 24 && up > Math.abs(dx)) {
    return { kind: 'swipe', strength: Math.min(1, Math.max(.15, up / Math.max(1, end.t - start.t) / 1.5)) };
  }
  return { kind: Math.hypot(dx, up) <= 10 ? 'tap' : 'none', strength: .35 };
}
