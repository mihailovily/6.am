/** @typedef {{ format: string, size: number, errorLevel: string, version: string, mask: string, quietZone: string, dark: string, light: string }} QrSettings */
/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} StorageLike */

export const QR_STORAGE_KEY = '6am-qr-settings-v1';

export const FORMATS = new Set(['QRCode', 'DataMatrix', 'Aztec', 'PDF417', 'Code128', 'Code39', 'EAN8', 'EAN13', 'UPCA', 'ITF']);

/** @param {string} format */
export function isQrFormat(format) {
  return format === 'QRCode';
}

/** @param {Partial<QrSettings>} [value] @returns {QrSettings} */
export function normalizeSettings(value = {}) {
  const inputFormat = value.format ?? '';
  const inputErrorLevel = value.errorLevel ?? '';
  const inputVersion = value.version ?? '';
  const inputMask = value.mask ?? '';
  const inputDark = value.dark ?? '';
  const inputLight = value.light ?? '';
  const format = FORMATS.has(inputFormat) ? inputFormat : 'QRCode';
  const number = Number(value.size);
  const size = Number.isInteger(number) ? Math.min(4096, Math.max(128, number)) : 512;
  return {
    format,
    size,
    errorLevel: ['L', 'M', 'Q', 'H'].includes(inputErrorLevel) ? inputErrorLevel : 'M',
    version: Number.isInteger(Number(inputVersion)) && Number(inputVersion) >= 1 && Number(inputVersion) <= 40 ? String(inputVersion) : '',
    mask: Number.isInteger(Number(inputMask)) && Number(inputMask) >= 0 && Number(inputMask) <= 7 ? String(inputMask) : '',
    quietZone: value.quietZone === 'false' ? 'false' : 'true',
    dark: /^#[\da-f]{6}$/i.test(inputDark) ? inputDark : '#08090b',
    light: /^#[\da-f]{6}$/i.test(inputLight) ? inputLight : '#ffffff'
  };
}

/** @param {StorageLike} storage @param {Partial<QrSettings>} settings */
export function saveSettings(storage, settings) {
  try {
    storage.setItem(QR_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** @param {StorageLike} storage */
export function loadSettings(storage) {
  try {
    return normalizeSettings(JSON.parse(storage.getItem(QR_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeSettings();
  }
}

/** @param {string} value */
function hasValidCheckDigit(value) {
  const check = Number(value.at(-1));
  const sum = [...value.slice(0, -1)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** @param {string} format @param {string} content */
export function validateContent(format, content) {
  const value = content.trim();
  if (!value) return 'Enter content to generate a code.';
  if (format === 'EAN8' && (!/^\d{8}$/.test(value) || !hasValidCheckDigit(value))) return 'EAN-8 requires 8 digits with a valid check digit.';
  if (format === 'EAN13' && (!/^\d{13}$/.test(value) || !hasValidCheckDigit(value))) return 'EAN-13 requires 13 digits with a valid check digit.';
  if (format === 'UPCA' && (!/^\d{12}$/.test(value) || !hasValidCheckDigit(value))) return 'UPC-A requires 12 digits with a valid check digit.';
  if (format === 'ITF' && (!/^\d+$/.test(value) || value.length % 2 !== 0)) return 'ITF requires an even number of digits.';
  if (format === 'Code39' && !/^[0-9A-Z .\-$/+%]+$/.test(value)) return 'Code 39 accepts uppercase A–Z, digits, space and . - $ / + %.';
  return '';
}

/** @param {QrSettings} settings */
export function writerOptions(settings) {
  const options = [];
  if (isQrFormat(settings.format)) {
    options.push(`ecLevel=${settings.errorLevel}`);
    if (settings.version) options.push(`version=${settings.version}`);
    if (settings.mask) options.push(`dataMask=${settings.mask}`);
  }
  return {
    format: settings.format,
    sizeHint: settings.size,
    options: options.join(','),
    addQuietZones: settings.quietZone === 'true'
  };
}

/** @param {string} value */
export function isOpenableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
