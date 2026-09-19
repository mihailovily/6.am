const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** @param {Uint8Array} bytes */
function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** @param {string} value */
function base64UrlToBytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

/** @param {string} plaintext */
export async function encryptNote(plaintext) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoder.encode(plaintext));
  return { key: bytesToBase64Url(keyBytes), nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) };
}

/** @param {string} keyValue @param {string} code */
export async function proofFor(keyValue, code) {
  const key = await crypto.subtle.importKey('raw', base64UrlToBytes(keyValue), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`6.am/note/${code}`))));
}

/** @param {{ key: string, nonce: string, ciphertext: string }} encrypted */
export async function decryptNote({ key: keyValue, nonce, ciphertext }) {
  const key = await crypto.subtle.importKey('raw', base64UrlToBytes(keyValue), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(nonce) }, key, base64UrlToBytes(ciphertext));
  return decoder.decode(plaintext);
}
