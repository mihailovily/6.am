export const ALLOWED_LIFETIMES = new Set([24, 72, 168]);
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function codeFor(sequence) {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('Sequence must be a non-negative safe integer.');
  let value = sequence;
  let result = '';
  do {
    result = alphabet[value % alphabet.length] + result;
    value = Math.floor(value / alphabet.length) - 1;
  } while (value >= 0);
  return result;
}

export function validLifetime(value) { return ALLOWED_LIFETIMES.has(value); }

export function validDestination(value) {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}

export function expiryAt(now, hours) { return now + hours * 60 * 60 * 1000; }
