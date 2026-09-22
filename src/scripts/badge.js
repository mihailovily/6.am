import { BADGE_DEFAULTS, normalizeBadge, validBadgeLink } from './badge-domain.js';
import { drawPhoto, renderBadge } from './badge-renderer.js';

/** @template {HTMLElement} T @param {string} selector @returns {T} */
function $(selector) { return /** @type {T} */ (document.querySelector(selector)); }
const form = /** @type {HTMLFormElement} */ ($('#badge-form'));
const preview = /** @type {HTMLCanvasElement} */ ($('#badge-preview'));
const display = /** @type {HTMLCanvasElement} */ ($('#badge-display'));
const presentation = /** @type {HTMLDialogElement} */ ($('#badge-presentation'));
const device = /** @type {HTMLSelectElement} */ ($('#badge-device'));
const download = /** @type {HTMLButtonElement} */ ($('#badge-download'));
const share = /** @type {HTMLButtonElement} */ ($('#badge-share'));
const show = /** @type {HTMLButtonElement} */ ($('#badge-show'));
let state = { ...BADGE_DEFAULTS };
/** @type {HTMLImageElement|null} */ let photo = null;
/** @type {Blob|null} */ let photoBlob = null;
/** @type {HTMLImageElement|null} */ let qr = null;
/** @type {IDBDatabase|null} */ let database = null;
/** @type {WakeLockSentinel|null} */ let wake = null;
/** @type {File|null} */ let exportFile = null;
let revision = 0, photoRevision = 0, wakeRevision = 0, qrLink = '', qrFailed = false;

/** @param {Blob} blob */
async function imageFromBlob(blob) {
  const image = new Image(); const url = URL.createObjectURL(blob);
  try { image.src = url; await image.decode(); return image; }
  finally { URL.revokeObjectURL(url); }
}
function applyForm() {
  for (const [key, value] of Object.entries(state)) {
    const input = form.elements.namedItem(key);
    if (input instanceof RadioNodeList) input.value = String(value);
    else if (input instanceof HTMLInputElement) input.value = String(value);
  }
  const size = `${state.width}x${state.height}`;
  device.value = [...device.options].some(option => option.value === size) ? size : 'custom';
  $('#badge-dimensions').hidden = device.value !== 'custom';
}
function persist() {
  if (!database) return;
  const failed = () => { $('#badge-storage').textContent = 'Changes could not be saved. You can still show or download your badge.'; };
  try {
    const transaction = database.transaction('badge', 'readwrite');
    transaction.objectStore('badge').put({ state: { ...state }, photo: photoBlob }, 'current');
    transaction.oncomplete = () => { $('#badge-storage').textContent = 'Saved on this device. Nothing is uploaded.'; };
    transaction.onerror = transaction.onabort = failed;
  } catch { failed(); }
}
async function restore() {
  try {
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('6am-badge-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('badge');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage blocked'));
    });
    const db = database;
    if (!db) throw new Error('Storage unavailable');
    db.onversionchange = () => { database?.close(); database = null; $('#badge-storage').textContent = 'Storage changed. Reload to save changes.'; };
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('badge').objectStore('badge').get('current');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    state = normalizeBadge(record?.state);
    if (record?.photo instanceof Blob) { photoBlob = record.photo; photo = await imageFromBlob(record.photo); }
    $('#badge-storage').textContent = 'Saved only on this device. Nothing is uploaded.';
  } catch { $('#badge-storage').textContent = 'Local storage is unavailable. Changes will last only for this session.'; }
  applyForm(); form.inert = false; await refresh();
}
async function makeQr() {
  const [{ prepareZXingModule, writeBarcode }, wasm] = await Promise.all([import('zxing-wasm'), import('zxing-wasm/full/zxing_full.wasm?url')]);
  prepareZXingModule({ overrides: { locateFile: (/** @type {string} */ path) => path.endsWith('.wasm') ? wasm.default : path } });
  const result = await writeBarcode(state.link.trim(), { format: 'QRCode', sizeHint: 512, options: 'ecLevel=M', addQuietZones: true });
  if (result.error || !result.svg) throw new Error('QR generation failed');
  // Explicit white background keeps the QR independent of the badge palette.
  const svg = result.svg.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="white"/>');
  return imageFromBlob(new Blob([svg], { type: 'image/svg+xml' }));
}
function renderPresentation() {
  if (!presentation.open) return;
  display.width = Math.round(presentation.clientWidth * Math.min(devicePixelRatio, 2));
  display.height = Math.round(presentation.clientHeight * Math.min(devicePixelRatio, 2));
  renderBadge(display, state, photo, qr, true);
}
async function refresh() {
  const ticket = ++revision;
  exportFile = null; download.disabled = share.disabled = show.disabled = true;
  $('[data-color="lanyard"]').hidden = state.template === 'minimal';
  $('#badge-crop').hidden = !photo;
  if (photo) {
    const crop = /** @type {HTMLCanvasElement} */ ($('#badge-crop-preview'));
    const ctx = crop.getContext('2d');
    crop.height = state.template === 'minimal' ? 400 : 320;
    if (ctx) drawPhoto(ctx, photo, state, 0, 0, crop.width, crop.height);
  }
  let error = '';
  if (!validBadgeLink(state.link)) error = 'Enter a complete http:// or https:// link.';
  if (state.link.trim() !== qrLink || qrFailed) {
    qr = null; qrFailed = false;
    if (!error && state.link.trim()) {
      try { const next = await makeQr(); if (ticket !== revision) return; qr = next; }
      catch { if (ticket !== revision) return; qrFailed = true; error = 'Could not generate the QR. Edit the link to retry, or remove it.'; }
    }
    qrLink = state.link.trim();
  }
  if (ticket !== revision) return;
  if (qrFailed) error = 'Could not generate the QR. Edit the link to retry, or remove it.';
  preview.width = state.width; preview.height = state.height;
  const overflow = renderBadge(preview, state, photo, error ? null : qr);
  const label = [state.name || 'Your name', state.role, state.company].filter(Boolean).join(', ');
  preview.setAttribute('aria-label', label); display.setAttribute('aria-label', label);
  if (overflow) error = 'This text is too long to fit. Shorten the name, role or company.';
  if (!state.name.trim()) error ||= 'Add your name to show or download your badge.';
  const dimensionsValid = ['width', 'height'].every(key => /** @type {HTMLInputElement} */ (form.elements.namedItem(key)).validity.valid);
  if (!dimensionsValid) error = 'Use whole pixels: width 320–2160, height 568–4320.';
  $('#badge-error').textContent = error;
  $('#badge-resolution').textContent = `${state.width} × ${state.height}`;
  renderPresentation();
  if (error) return;
  const blob = await new Promise((resolve) => preview.toBlob(resolve, 'image/png'));
  if (ticket !== revision) return;
  if (!blob) { $('#badge-error').textContent = 'Could not create the image. Try a smaller resolution.'; return; }
  exportFile = new File([blob], '6am-badge.png', { type: 'image/png' });
  download.disabled = show.disabled = false;
  share.hidden = !navigator.canShare?.({ files: [exportFile] }); share.disabled = false;
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'file') return;
  state = normalizeBadge(Object.fromEntries(new FormData(form)));
  persist(); void refresh();
});
device.addEventListener('change', () => {
  if (device.value !== 'custom') {
    const [width, height] = device.value.split('x').map(Number);
    state.width = width; state.height = height; applyForm();
  }
  $('#badge-dimensions').hidden = device.value !== 'custom';
  persist(); void refresh();
});
for (const selector of ['#badge-photo', '#badge-camera']) {
  $(selector).addEventListener('change', async event => {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    const ticket = ++photoRevision;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      $('#badge-feedback').textContent = 'Choose a JPEG, PNG or WebP image up to 10 MB.'; return;
    }
    try {
      const image = await imageFromBlob(file);
      // Retain enough detail for export without keeping oversized decoded photos in memory.
      const canvas = document.createElement('canvas'); const ratio = Math.min(1, 2400 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Decode failed');
      const decoded = await imageFromBlob(blob);
      if (ticket !== photoRevision) return;
      photo = decoded; photoBlob = blob; state.zoom = 1; state.panX = state.panY = .5;
      applyForm(); persist(); await refresh(); $('#badge-feedback').textContent = 'Photo ready. Adjust the crop below.';
    } catch { if (ticket === photoRevision) $('#badge-feedback').textContent = 'This photo could not be opened. Try a JPEG, PNG or WebP image.'; }
  });
}
$('#badge-remove').addEventListener('click', () => { ++photoRevision; photo = null; photoBlob = null; persist(); void refresh(); });
$('#badge-palette').addEventListener('click', () => {
  for (const key of /** @type {const} */ (['background', 'card', 'ink', 'lanyard'])) state[key] = BADGE_DEFAULTS[key];
  applyForm(); persist(); void refresh();
});
$('#badge-reset').addEventListener('click', () => {
  if (!window.confirm('Reset your badge and remove the saved photo?')) return;
  ++photoRevision; state = { ...BADGE_DEFAULTS }; photo = null; photoBlob = null; applyForm(); persist(); void refresh();
});
download.addEventListener('click', () => {
  if (!exportFile) return;
  const url = URL.createObjectURL(exportFile); const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportFile.name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
share.addEventListener('click', async () => {
  if (!exportFile) return;
  try { await navigator.share({ files: [exportFile] }); }
  catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) $('#badge-feedback').textContent = 'Sharing is unavailable. Use Download PNG instead.'; }
});
async function keepAwake() {
  const ticket = ++wakeRevision;
  if (!presentation.open || document.visibilityState !== 'visible') return;
  if (wake && !wake.released) return;
  $('#badge-awake').textContent = 'Requesting screen wake lock…';
  try {
    if (!navigator.wakeLock) throw new Error('Unavailable');
    const sentinel = await navigator.wakeLock.request('screen');
    if (ticket !== wakeRevision || !presentation.open) { await sentinel.release(); return; }
    wake = sentinel; $('#badge-awake').textContent = 'Screen stays awake'; $('#badge-retry').hidden = true;
    sentinel.addEventListener('release', () => {
      if (wake !== sentinel) return;
      wake = null; $('#badge-awake').textContent = 'Keep awake stopped'; $('#badge-retry').hidden = false;
    });
  } catch {
    if (ticket !== wakeRevision || !presentation.open) return;
    $('#badge-awake').textContent = 'Keep awake unavailable. Check your auto-lock settings.'; $('#badge-retry').hidden = false;
  }
}
async function exitPresentation() {
  ++wakeRevision;
  if (wake) { const old = wake; wake = null; await old.release().catch(() => {}); }
  if (document.fullscreenElement === document.documentElement) await document.exitFullscreen().catch(() => {});
  presentation.close(); document.documentElement.classList.remove('badge-presenting'); show.focus();
}
show.addEventListener('click', async () => {
  show.disabled = true;
  // Open the modal after the fullscreen root enters the top layer, otherwise
  // the fullscreen root can cover the already-open dialog.
  try { await document.documentElement.requestFullscreen?.(); } catch { /* Use the viewport presentation. */ }
  presentation.showModal(); document.documentElement.classList.add('badge-presenting'); renderPresentation(); show.disabled = false;
  void keepAwake(); $('#badge-exit').focus();
});
$('#badge-exit').addEventListener('click', () => { void exitPresentation(); });
$('#badge-retry').addEventListener('click', () => { void keepAwake(); });
presentation.addEventListener('cancel', event => { event.preventDefault(); void exitPresentation(); });
let wasNativeFullscreen = false;
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement === document.documentElement) wasNativeFullscreen = true;
  else if (wasNativeFullscreen) { wasNativeFullscreen = false; void exitPresentation(); }
  renderPresentation();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && presentation.open) void keepAwake(); });
window.addEventListener('resize', renderPresentation);
form.inert = true; void restore();


