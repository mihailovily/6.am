import { encryptNote, proofFor } from './note-crypto.js';
import { readApiResponse } from './note-api.js';

const form = /** @type {HTMLFormElement} */ (document.querySelector('#note-form'));
const feedback = /** @type {HTMLParagraphElement} */ (document.querySelector('#note-feedback'));
const api = new URL(`${import.meta.env.BASE_URL}api/v1/notes`, window.location.origin);
let turnstileToken = '';
const runtimeWindow = /** @type {Window & typeof globalThis & { onTurnstileDone?: (token: string) => void, turnstile?: { render: (element: Element, options: { sitekey: string, callback: (token: string) => void }) => void } }} */ (window);

/** @param {string} message @param {boolean} [isError] */
function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
}

function setupTurnstile() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) return;
  const slot = /** @type {HTMLDivElement} */ (document.querySelector('#turnstile-slot'));
  const widget = document.createElement('div');
  widget.className = 'cf-turnstile';
  widget.dataset.sitekey = siteKey;
  slot.append(widget);
  runtimeWindow.onTurnstileDone = (token) => { turnstileToken = token; };
  widget.dataset.callback = 'onTurnstileDone';
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => runtimeWindow.turnstile?.render(widget, { sitekey: siteKey, callback: runtimeWindow.onTurnstileDone || (() => {}) });
  document.head.append(script);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
  const text = /** @type {HTMLTextAreaElement} */ (document.querySelector('#note-text'));
  const singleUse = /** @type {HTMLInputElement} */ (document.querySelector('#single-use'));
  const expiresInHours = Number(new FormData(form).get('ttl'));
  if (!text.value.trim()) return setFeedback('Write a note first.', true);
  button.disabled = true;
  setFeedback('Encrypting your note…');
  try {
    const encrypted = await encryptNote(text.value);
    const response = await fetch(api, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...encrypted, expiresInHours, singleUse: singleUse.checked, turnstileToken })
    });
    const payload = await readApiResponse(response, 'Create note');
    const proof = await proofFor(encrypted.key, payload.code);
    const proofResponse = await fetch(new URL(`${payload.code}/proof`, `${api.href}/`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proof, creationToken: payload.creationToken })
    });
    await readApiResponse(proofResponse, 'Finalize note');
    const link = `${window.location.origin}${import.meta.env.BASE_URL}shrt/${payload.code}#k=${encrypted.key}&p=${proof}`;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable.');
      await navigator.clipboard.writeText(link);
      setFeedback(`Link copied: ${link}`);
    } catch {
      setFeedback(`Note created. Copy this link: ${link}`);
    }
  } catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not create this note.', true); }
  finally { button.disabled = false; }
});

setupTurnstile();
