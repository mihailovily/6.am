// DOM controller: runtime dependencies are loaded lazily to keep the initial QR page light.
// @ts-nocheck
import {
  FORMATS,
  isOpenableUrl,
  isQrFormat,
  loadSettings,
  normalizeSettings,
  saveSettings,
  validateContent,
  writerOptions
} from './qr-domain.js';

const form = document.querySelector('#generator-form');
const feedback = document.querySelector('#generator-feedback');
const readerFeedback = document.querySelector('#reader-feedback');
const preview = document.querySelector('#qr-preview');
const actions = document.querySelector('#qr-actions');
const formatInput = document.querySelector('#qr-format');
const fileInput = document.querySelector('#reader-file');
const cameraSelect = document.querySelector('#camera-select');
const video = document.querySelector('#camera-video');
const cameraPlaceholder = document.querySelector('#camera-placeholder');
const startCamera = document.querySelector('#start-camera');
const stopCamera = document.querySelector('#stop-camera');
const readerResult = document.querySelector('#reader-result');
const resultText = document.querySelector('#reader-text');
const resultFormat = document.querySelector('#reader-format');
const openResult = document.querySelector('#open-result');

let barcode = null;
let previewUrl = '';
let currentSvg = '';
let currentPng = null;
let stream = null;
let scanTimer = 0;
let scanPending = false;

function setFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function formSettings() {
  return normalizeSettings(Object.fromEntries(new FormData(form)));
}

function applySettings(settings) {
  for (const [name, value] of Object.entries(settings)) {
    const input = form.elements.namedItem(name);
    if (input && 'value' in input) input.value = value;
  }
}

function updateFormatFields() {
  const qr = isQrFormat(formatInput.value);
  for (const id of ['qr-error-level', 'qr-version', 'qr-mask']) document.querySelector(`#${id}`).disabled = !qr;
  document.querySelector('#format-note').textContent = qr
    ? 'QR controls affect error correction, capacity and masking. Higher correction reduces capacity.'
    : 'Error correction, version and mask apply only to QR Code and are disabled for this format.';
}

async function getBarcodeEngine() {
  if (barcode) return barcode;
  const [{ prepareZXingModule, readBarcodes, writeBarcode }, wasm] = await Promise.all([
    import('zxing-wasm'),
    import('zxing-wasm/full/zxing_full.wasm?url')
  ]);
  prepareZXingModule({ overrides: { locateFile: (path) => path.endsWith('.wasm') ? wasm.default : path } });
  barcode = { readBarcodes, writeBarcode };
  return barcode;
}

function colourSvg(svg, settings) {
  return svg
    .replace(/<svg\b([^>]*)>/i, `<svg$1 style="background:${settings.light}">`)
    .replaceAll('#000000', settings.dark)
    .replaceAll('#FFFFFF', settings.light)
    .replaceAll('#ffffff', settings.light);
}

async function pngFromSvg(svg, size, light) {
  const image = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.fillStyle = light;
    context.fillRect(0, 0, size, size);
    const ratio = Math.min(size / image.width, size / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function generate(event) {
  event?.preventDefault();
  const settings = formSettings();
  const content = String(form.elements.content.value);
  const validation = validateContent(settings.format, content);
  if (validation) return setFeedback(feedback, validation, true);
  setFeedback(feedback, 'Generating locally…');
  try {
    const engine = await getBarcodeEngine();
    const result = await engine.writeBarcode(content, writerOptions(settings));
    if (result.error) throw new Error(result.error);
    currentSvg = colourSvg(result.svg, settings);
    currentPng = await pngFromSvg(currentSvg, settings.size, settings.light);
    if (!currentPng) throw new Error('PNG export is unavailable in this browser.');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(new Blob([currentSvg], { type: 'image/svg+xml' }));
    preview.replaceChildren(Object.assign(document.createElement('img'), { src: previewUrl, alt: `${formatInput.selectedOptions[0].text} preview` }));
    actions.hidden = false;
    saveSettings(localStorage, settings);
    setFeedback(feedback, 'Generated locally. Nothing was uploaded or saved.');
  } catch (error) {
    setFeedback(feedback, `Could not generate this code: ${error instanceof Error ? error.message : 'unknown error'}`, true);
  }
}

function showResult(result) {
  resultFormat.textContent = result.format.replace(/([a-z])([A-Z])/g, '$1 $2');
  resultText.textContent = result.text;
  if (isOpenableUrl(result.text)) {
    openResult.href = result.text;
    openResult.hidden = false;
  } else {
    openResult.hidden = true;
    openResult.removeAttribute('href');
  }
  readerResult.hidden = false;
}

async function scan(source, status = 'Scanning locally…') {
  setFeedback(readerFeedback, status);
  try {
    const engine = await getBarcodeEngine();
    const results = await engine.readBarcodes(source, { formats: [...FORMATS], tryHarder: true, maxNumberOfSymbols: 1 });
    if (!results.length) return setFeedback(readerFeedback, 'No supported barcode was found. Try a sharper, brighter image.', true);
    showResult(results[0]);
    setFeedback(readerFeedback, 'Code read locally.');
    stopLiveCamera();
  } catch (error) {
    setFeedback(readerFeedback, `Could not read this image: ${error instanceof Error ? error.message : 'unknown error'}`, true);
  }
}

async function scanFile() {
  const file = fileInput.files?.[0];
  if (!file) return setFeedback(readerFeedback, 'Choose an image before scanning.', true);
  await scan(file);
}

function videoFrame() {
  if (!stream || scanPending || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return;
  context.drawImage(video, 0, 0);
  scanPending = true;
  scan(context.getImageData(0, 0, canvas.width, canvas.height), 'Looking for a code…').finally(() => { scanPending = false; });
}

function stopLiveCamera() {
  if (scanTimer) window.clearInterval(scanTimer);
  scanTimer = 0;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  video.hidden = true;
  cameraPlaceholder.hidden = false;
  startCamera.disabled = false;
  stopCamera.disabled = true;
}

async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const previous = cameraSelect.value;
  cameraSelect.replaceChildren(Object.assign(document.createElement('option'), { value: '', textContent: 'Default camera' }));
  devices.filter((device) => device.kind === 'videoinput').forEach((device, index) => {
    cameraSelect.append(Object.assign(document.createElement('option'), { value: device.deviceId, textContent: device.label || `Camera ${index + 1}` }));
  });
  cameraSelect.value = previous;
}

async function startLiveCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setFeedback(readerFeedback, 'Camera access needs HTTPS or localhost in a supported browser.', true);
  stopLiveCamera();
  setFeedback(readerFeedback, 'Requesting camera access…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: cameraSelect.value ? { deviceId: { exact: cameraSelect.value } } : { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream;
    await video.play();
    video.hidden = false;
    cameraPlaceholder.hidden = true;
    startCamera.disabled = true;
    stopCamera.disabled = false;
    await listCameras();
    setFeedback(readerFeedback, 'Camera is on. Hold a code inside the frame.');
    scanTimer = window.setInterval(videoFrame, 500);
  } catch (error) {
    stopLiveCamera();
    setFeedback(readerFeedback, `Camera could not start: ${error instanceof Error ? error.message : 'permission denied'}`, true);
  }
}

async function copyText(value, success) {
  try {
    await navigator.clipboard.writeText(value);
    setFeedback(feedback, success);
  } catch {
    setFeedback(feedback, 'Clipboard access is unavailable. Download the file instead.', true);
  }
}

document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
  const isGenerate = tab.id === 'generate-tab';
  document.querySelector('#generate-tab').setAttribute('aria-selected', String(isGenerate));
  document.querySelector('#reader-tab').setAttribute('aria-selected', String(!isGenerate));
  document.querySelector('#generate-tab').tabIndex = isGenerate ? 0 : -1;
  document.querySelector('#reader-tab').tabIndex = isGenerate ? -1 : 0;
  document.querySelector('#generate-panel').hidden = !isGenerate;
  document.querySelector('#reader-panel').hidden = isGenerate;
  if (isGenerate) stopLiveCamera();
}));

form.addEventListener('submit', generate);
formatInput.addEventListener('change', updateFormatFields);
document.querySelector('#scan-file').addEventListener('click', scanFile);
startCamera.addEventListener('click', startLiveCamera);
stopCamera.addEventListener('click', () => { stopLiveCamera(); setFeedback(readerFeedback, 'Camera stopped.'); });
document.querySelector('#download-svg').addEventListener('click', () => download(new Blob([currentSvg], { type: 'image/svg+xml' }), '6am-code.svg'));
document.querySelector('#download-png').addEventListener('click', () => currentPng && download(currentPng, '6am-code.png'));
document.querySelector('#copy-svg').addEventListener('click', () => copyText(currentSvg, 'SVG copied.'));
document.querySelector('#copy-image').addEventListener('click', async () => {
  try {
    if (!currentPng || !window.ClipboardItem) throw new Error('Clipboard image support is unavailable.');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentPng })]);
    setFeedback(feedback, 'Image copied.');
  } catch {
    setFeedback(feedback, 'Image clipboard is unavailable. Download PNG instead.', true);
  }
});
document.querySelector('#copy-result').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText.textContent || '');
    setFeedback(readerFeedback, 'Result copied.');
  } catch {
    setFeedback(readerFeedback, 'Clipboard access is unavailable. Select the result text to copy it.', true);
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopLiveCamera(); });
window.addEventListener('pagehide', stopLiveCamera);

applySettings(loadSettings(localStorage));
updateFormatFields();
