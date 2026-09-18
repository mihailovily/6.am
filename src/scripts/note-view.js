import { decryptNote } from './note-crypto.js';
import { readApiResponse } from './note-api.js';

const feedback = /** @type {HTMLParagraphElement} */ (document.querySelector('#reveal-feedback'));
const button = /** @type {HTMLButtonElement} */ (document.querySelector('#reveal-note'));
const output = /** @type {HTMLPreElement} */ (document.querySelector('#revealed-note'));
const params = new URLSearchParams(window.location.hash.slice(1));
const code = window.location.pathname.split('/').filter(Boolean).at(-1);
const key = params.get('k');
const proof = params.get('p');
const api = code ? new URL(`${import.meta.env.BASE_URL}api/v1/notes/${encodeURIComponent(code)}/reveal`, window.location.origin) : null;

/** @param {string} message @param {boolean} [isError] */
function setFeedback(message, isError = false) { feedback.textContent = message; feedback.classList.toggle('error', isError); }

if (!key || !proof || !code || !api) {
  button.disabled = true;
  setFeedback('This link is missing its secret key.', true);
}

button.addEventListener('click', async () => {
  button.disabled = true;
  setFeedback('Retrieving encrypted note…');
  try {
    if (!api || !key || !proof) throw new Error('This link is missing its secret key.');
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proof }) });
    const payload = await readApiResponse(response, 'Reveal note');
    output.textContent = await decryptNote({ key, nonce: payload.nonce, ciphertext: payload.ciphertext });
    output.hidden = false;
    button.hidden = true;
    setFeedback(payload.singleUse ? 'This note has now been destroyed.' : 'This note remains available until it expires.');
  } catch (error) { setFeedback(error instanceof Error ? error.message : 'This note is unavailable.', true); button.disabled = false; }
});
