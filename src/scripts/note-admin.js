import { readApiResponse } from './note-api.js';

const form = /** @type {HTMLFormElement} */ (document.querySelector('#link-form'));
const feedback = /** @type {HTMLParagraphElement} */ (document.querySelector('#link-feedback'));
const api = new URL(`${import.meta.env.BASE_URL}api/v1/admin/links`, window.location.origin);
/** @param {string} message @param {boolean} [isError] */
function setFeedback(message, isError = false) { feedback.textContent = message; feedback.classList.toggle('error', isError); }
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
  const target = /** @type {HTMLInputElement} */ (document.querySelector('#target-url'));
  button.disabled = true;
  try {
    const response = await fetch(api, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target.value, expiresInHours: Number(new FormData(form).get('ttl')) }) });
    const payload = await readApiResponse(response, 'Create short link');
    const link = `${window.location.origin}${import.meta.env.BASE_URL}shrt/${payload.code}`;
    await navigator.clipboard?.writeText(link);
    setFeedback(`Link copied: ${link}`);
  } catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not create this link.', true); }
  finally { button.disabled = false; }
});
