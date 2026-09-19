import { DEFAULT_LIFE_COLORS, LIFE_COLOR_KEYS, LIFE_PALETTES, localDate, mixHexColors, normalizeHexColor, normalizeLifeSettings, paletteForColors, parseWallpaperRequest } from './life-domain.js';

const STORAGE_KEY = '6am-life-settings-v1';

/** @param {string} selector */
function element(selector) {
  const result = document.querySelector(selector);
  if (!result) throw new Error(`Missing Life UI element: ${selector}`);
  return result;
}

const form = /** @type {HTMLFormElement} */ (element('#life-form'));
const settingsForm = /** @type {HTMLFormElement} */ (element('#life-settings-form'));
const generatorPanel = /** @type {HTMLElement} */ (element('#life-workspace'));
const settingsPanel = /** @type {HTMLElement} */ (element('#life-settings-panel'));
const tabs = [...document.querySelectorAll('.life-tab')].map((item) => /** @type {HTMLButtonElement} */ (item));
const layoutButtons = [...document.querySelectorAll('[data-layout]')].map((item) => /** @type {HTMLButtonElement} */ (item));
const paletteInputs = [...document.querySelectorAll('input[name="palette"]')].map((item) => /** @type {HTMLInputElement} */ (item));
const colorHexInputs = Object.fromEntries([...document.querySelectorAll('[data-color-hex]')].map((item) => [/** @type {HTMLInputElement} */ (item).dataset.colorHex, item]));
const colorPickers = Object.fromEntries([...document.querySelectorAll('[data-color-picker]')].map((item) => [/** @type {HTMLInputElement} */ (item).dataset.colorPicker, item]));
const birthdaySection = /** @type {HTMLElement} */ (element('#birthday-section'));
const yearLayoutSection = /** @type {HTMLElement} */ (element('#year-layout-section'));
const goalSection = /** @type {HTMLElement} */ (element('#goal-section'));
const birthdayInput = /** @type {HTMLInputElement} */ (element('#life-birthday'));
const goalTitle = /** @type {HTMLInputElement} */ (element('#goal-title'));
const goalStart = /** @type {HTMLInputElement} */ (element('#goal-start'));
const goalDeadline = /** @type {HTMLInputElement} */ (element('#goal-deadline'));
const deviceSelect = /** @type {HTMLSelectElement} */ (element('#device-model'));
const customSize = /** @type {HTMLElement} */ (element('#custom-size'));
const customWidth = /** @type {HTMLInputElement} */ (element('#custom-width'));
const customHeight = /** @type {HTMLInputElement} */ (element('#custom-height'));
const timeZoneInput = /** @type {HTMLInputElement} */ (element('#life-timezone'));
const customColors = /** @type {HTMLElement} */ (element('#life-custom-colors'));
const palettePreview = /** @type {HTMLElement} */ (element('#life-palette-preview'));
const contrastWarning = /** @type {HTMLElement} */ (element('#life-contrast-warning'));
const settingsFeedback = /** @type {HTMLElement} */ (element('#life-settings-feedback'));
const settingsError = /** @type {HTMLElement} */ (element('#life-settings-error'));
const resetSettingsButton = /** @type {HTMLButtonElement} */ (element('#reset-life-settings'));
const preview = /** @type {HTMLImageElement} */ (element('#wallpaper-preview'));
const previewLoading = /** @type {HTMLElement} */ (element('#preview-loading'));
const urlOutput = /** @type {HTMLOutputElement} */ (element('#wallpaper-url'));
const errorOutput = /** @type {HTMLElement} */ (element('#life-error'));
const feedback = /** @type {HTMLElement} */ (element('#life-feedback'));
const copyButton = /** @type {HTMLButtonElement} */ (element('#copy-wallpaper'));
const downloadButton = /** @type {HTMLButtonElement} */ (element('#download-wallpaper'));
const installButton = /** @type {HTMLButtonElement} */ (element('#open-install'));
const dialog = /** @type {HTMLDialogElement} */ (element('#install-dialog'));
const dialogClose = /** @type {HTMLButtonElement} */ (element('#install-close'));
const platformChoice = /** @type {HTMLElement} */ (element('#platform-choice'));
const installSteps = /** @type {HTMLElement} */ (element('#install-steps'));
const installBack = /** @type {HTMLButtonElement} */ (element('#install-back'));
const stepsHeading = /** @type {HTMLElement} */ (element('#steps-heading'));
const stepsList = /** @type {HTMLOListElement} */ (element('#steps-list'));
const installUrl = /** @type {HTMLOutputElement} */ (element('#install-url'));
const copyInstallUrl = /** @type {HTMLButtonElement} */ (element('#copy-install-url'));
const installFeedback = /** @type {HTMLElement} */ (element('#install-feedback'));

/** @type {'life'|'year'|'goal'} */
let mode = 'life';
/** @type {'life'|'year'|'goal'|'settings'} */
let activeView = 'life';
/** @type {'days'|'months'|'quarters'} */
let layout = 'days';
let currentWallpaperUrl = '';
let renderTimer = 0;

function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

function readStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeLifeSettings(raw ? JSON.parse(raw) : null, browserTimeZone());
  } catch {
    return normalizeLifeSettings(null, browserTimeZone());
  }
}

let appliedSettings = readStoredSettings();

function localIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setDefaults() {
  const today = new Date();
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + 90);
  goalStart.value = localIso(today);
  goalDeadline.value = localIso(deadline);
}

function populateTimeZones() {
  try {
    const supportedValuesOf = /** @type {{supportedValuesOf?: (key: 'timeZone') => string[]}} */ (Intl).supportedValuesOf;
    if (!supportedValuesOf) return;
    const options = supportedValuesOf('timeZone').map((timeZone) => {
      const option = document.createElement('option');
      option.value = timeZone;
      return option;
    });
    element('#life-timezone-options').replaceChildren(...options);
  } catch {}
}

/** @param {unknown} value */
function inputHex(value) {
  return normalizeHexColor(typeof value === 'string' ? value.trim().replace(/^#/, '') : value);
}

/** @param {{timeZone: string, palette: string, colors: import('./life-domain.js').LifeColors}} settings */
function syncSettingsInputs(settings) {
  timeZoneInput.value = settings.timeZone;
  const palette = settings.palette in LIFE_PALETTES || settings.palette === 'custom' ? settings.palette : paletteForColors(settings.colors);
  paletteInputs.forEach((input) => { input.checked = input.value === palette; });
  for (const key of LIFE_COLOR_KEYS) {
    const value = normalizeHexColor(settings.colors[key]) || DEFAULT_LIFE_COLORS[key];
    /** @type {HTMLInputElement} */ (colorHexInputs[key]).value = value.toUpperCase();
    /** @type {HTMLInputElement} */ (colorPickers[key]).value = `#${value}`;
  }
  customColors.hidden = palette !== 'custom';
  updatePalettePreview();
}

function draftColors() {
  return Object.fromEntries(LIFE_COLOR_KEYS.map((key) => [key, inputHex(/** @type {HTMLInputElement} */ (colorHexInputs[key]).value)]));
}

/** @param {string} hex */
function luminance(hex) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

/** @param {string} first @param {string} second */
function contrast(first, second) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function updatePalettePreview() {
  const colors = draftColors();
  if (Object.values(colors).some((value) => !value)) return;
  const valid = /** @type {Record<string, string>} */ (colors);
  palettePreview.style.setProperty('--preview-background', `#${valid.background}`);
  palettePreview.style.setProperty('--preview-past', `#${valid.past}`);
  palettePreview.style.setProperty('--preview-future', `#${valid.future}`);
  palettePreview.style.setProperty('--preview-current', `#${valid.current}`);
  palettePreview.style.setProperty('--preview-secondary', `#${mixHexColors(valid.background, valid.past, 0.65)}`);
  contrastWarning.hidden = contrast(valid.background, valid.past) >= 3
    && contrast(valid.background, valid.future) >= 1.15
    && contrast(valid.future, valid.current) >= 1.25;
}

function dimensions() {
  const value = deviceSelect.value === 'custom' ? `${customWidth.value}x${customHeight.value}` : deviceSelect.value;
  const [width, height] = value.split('x');
  return { width, height };
}

function endpointUrl() {
  const { width, height } = dimensions();
  const calendar = mode === 'year' ? layout : mode;
  const url = new URL('/api/v1/life/wallpaper.png', window.location.origin);
  url.searchParams.set('calendar', calendar);
  url.searchParams.set('width', width);
  url.searchParams.set('height', height);
  url.searchParams.set('tz', appliedSettings.timeZone);
  for (const [key, value] of Object.entries(appliedSettings.colors)) url.searchParams.set(key, value);
  if (calendar === 'life') url.searchParams.set('birthday', birthdayInput.value);
  if (calendar === 'goal') {
    url.searchParams.set('title', goalTitle.value.trim());
    url.searchParams.set('start', goalStart.value);
    url.searchParams.set('deadline', goalDeadline.value);
  }
  return url;
}

/** @param {URL} endpoint */
function updatePageQuery(endpoint) {
  const page = new URL(window.location.href);
  page.search = endpoint.search;
  page.hash = activeView === 'settings' ? 'settings' : '';
  window.history.replaceState(null, '', page);
}

function render() {
  const endpoint = endpointUrl();
  const parsed = parseWallpaperRequest(endpoint);
  if (!parsed.ok) {
    errorOutput.textContent = parsed.error;
    currentWallpaperUrl = '';
    urlOutput.textContent = 'Complete the settings to generate a URL.';
    preview.removeAttribute('src');
    previewLoading.hidden = true;
    copyButton.disabled = true;
    downloadButton.disabled = true;
    installButton.disabled = true;
    return;
  }
  errorOutput.textContent = '';
  currentWallpaperUrl = endpoint.toString();
  urlOutput.textContent = currentWallpaperUrl;
  installUrl.textContent = currentWallpaperUrl;
  previewLoading.hidden = false;
  preview.src = currentWallpaperUrl;
  copyButton.disabled = false;
  downloadButton.disabled = false;
  installButton.disabled = false;
  updatePageQuery(endpoint);
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(render, 220);
}

function updateControls() {
  const settingsSelected = activeView === 'settings';
  generatorPanel.hidden = settingsSelected;
  settingsPanel.hidden = !settingsSelected;
  birthdaySection.hidden = mode !== 'life';
  yearLayoutSection.hidden = mode !== 'year';
  goalSection.hidden = mode !== 'goal';
  customSize.hidden = deviceSelect.value !== 'custom';
  tabs.forEach((tab) => {
    const selected = tab.dataset.view === activeView;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  generatorPanel.setAttribute('aria-labelledby', `${mode}-tab`);
  const page = new URL(window.location.href);
  page.hash = settingsSelected ? 'settings' : '';
  window.history.replaceState(null, '', page);
  if (!settingsSelected) scheduleRender();
}

function restoreQuery() {
  const params = new URLSearchParams(window.location.search);
  const calendar = params.get('calendar');
  if (calendar === 'life' || calendar === 'goal') mode = calendar;
  if (['days', 'months', 'quarters'].includes(calendar || '')) {
    mode = 'year';
    layout = /** @type {'days'|'months'|'quarters'} */ (calendar);
  }
  activeView = window.location.hash === '#settings' ? 'settings' : mode;
  const birthday = params.get('birthday');
  const title = params.get('title');
  const start = params.get('start');
  const deadline = params.get('deadline');
  if (birthday) birthdayInput.value = birthday;
  if (title) goalTitle.value = title;
  if (start) goalStart.value = start;
  if (deadline) goalDeadline.value = deadline;

  const urlTimeZone = params.get('tz');
  if (urlTimeZone && localDate(new Date(), urlTimeZone)) appliedSettings.timeZone = urlTimeZone;
  const urlColors = { ...appliedSettings.colors };
  for (const key of LIFE_COLOR_KEYS) {
    const value = params.get(key);
    const normalized = value ? normalizeHexColor(value) : null;
    if (normalized) urlColors[key] = normalized;
  }
  appliedSettings = { ...appliedSettings, palette: paletteForColors(urlColors), colors: urlColors };
  syncSettingsInputs(appliedSettings);

  const width = params.get('width');
  const height = params.get('height');
  if (width && height) {
    const value = `${width}x${height}`;
    const preset = [...deviceSelect.options].some((option) => option.value === value);
    deviceSelect.value = preset ? value : 'custom';
    customWidth.value = width;
    customHeight.value = height;
  }
  layoutButtons.forEach((button) => {
    const selected = button.dataset.layout === layout;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

/** @param {string} value @param {string} message @param {HTMLElement} [target] */
async function copyText(value, message, target = feedback) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    target.textContent = message;
  } catch {
    target.textContent = 'Copy failed. Select the URL and copy it manually.';
  }
}

const instructions = {
  ios: {
    title: 'Set up iOS Shortcuts',
    steps: [
      'Open Shortcuts, choose Automation, and create a personal Time of Day automation for 6:00 AM every day.',
      'Choose Run Immediately, create a blank shortcut, and add Get Contents of URL.',
      'Paste the generated 6.am URL below into the URL field.',
      'Add Set Wallpaper Photo and choose the Lock Screen you want to update.',
      'Turn off Crop to Subject and Show Preview, save the automation, then run it once to test.'
    ]
  },
  android: {
    title: 'Set up MacroDroid',
    steps: [
      'Install MacroDroid and create a macro with the Date/Time → Day/Time trigger at 00:01 on every day.',
      'Add Web Interactions → HTTP Request, choose GET, and paste the generated 6.am URL below.',
      'Enable waiting for the request and save its response to /Download/6am-life.png.',
      'Add Device Settings → Set Wallpaper, choose the lock screen, and select that downloaded file.',
      'Save the macro and use Test Actions once. Android may ask for storage or wallpaper permissions.'
    ]
  }
};

/** @param {'ios'|'android'} platform */
function showPlatform(platform) {
  const guide = instructions[platform];
  platformChoice.hidden = true;
  installSteps.hidden = false;
  stepsHeading.textContent = guide.title;
  stepsList.replaceChildren(...guide.steps.map((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    return item;
  }));
  installFeedback.textContent = '';
  installBack.focus();
}

tabs.forEach((tab, index) => {
  const activate = () => {
    const selected = tab.dataset.view;
    if (selected === 'life' || selected === 'year' || selected === 'goal') {
      mode = selected;
      activeView = selected;
    } else if (selected === 'settings') activeView = 'settings';
    updateControls();
  };
  tab.addEventListener('click', activate);
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].click();
    tabs[nextIndex].focus();
  });
});

layoutButtons.forEach((button) => button.addEventListener('click', () => {
  const selectedLayout = button.dataset.layout;
  if (selectedLayout === 'days' || selectedLayout === 'months' || selectedLayout === 'quarters') layout = selectedLayout;
  layoutButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
  scheduleRender();
}));

paletteInputs.forEach((input) => input.addEventListener('change', () => {
  if (!input.checked) return;
  customColors.hidden = input.value !== 'custom';
  if (input.value in LIFE_PALETTES) syncSettingsInputs({ timeZone: timeZoneInput.value, palette: input.value, colors: LIFE_PALETTES[input.value] });
  else updatePalettePreview();
  settingsFeedback.textContent = '';
}));

for (const key of LIFE_COLOR_KEYS) {
  const hex = /** @type {HTMLInputElement} */ (colorHexInputs[key]);
  const picker = /** @type {HTMLInputElement} */ (colorPickers[key]);
  hex.addEventListener('input', () => {
    const value = inputHex(hex.value);
    if (value) picker.value = `#${value}`;
    const custom = paletteInputs.find((input) => input.value === 'custom');
    if (custom) custom.checked = true;
    customColors.hidden = false;
    updatePalettePreview();
  });
  picker.addEventListener('input', () => {
    hex.value = picker.value.slice(1).toUpperCase();
    const custom = paletteInputs.find((input) => input.value === 'custom');
    if (custom) custom.checked = true;
    customColors.hidden = false;
    updatePalettePreview();
  });
}

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  settingsFeedback.textContent = '';
  settingsError.textContent = '';
  const timeZone = timeZoneInput.value.trim();
  if (!localDate(new Date(), timeZone)) {
    settingsError.textContent = 'Enter a valid IANA time zone, such as Europe/Moscow.';
    timeZoneInput.focus();
    return;
  }
  const colors = draftColors();
  const invalidKey = Object.keys(colors).find((key) => !colors[key]);
  if (invalidKey) {
    settingsError.textContent = `${invalidKey[0].toUpperCase()}${invalidKey.slice(1)} must be a six-digit hex color.`;
    /** @type {HTMLInputElement} */ (colorHexInputs[invalidKey]).focus();
    return;
  }
  const validColors = /** @type {import('./life-domain.js').LifeColors} */ (colors);
  appliedSettings = { timeZone, palette: paletteForColors(validColors), colors: validColors };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appliedSettings));
    settingsFeedback.textContent = 'Settings saved on this device and applied to the wallpaper URL.';
  } catch {
    settingsFeedback.textContent = 'Settings are applied to this URL, but this browser could not save them.';
  }
  syncSettingsInputs(appliedSettings);
  render();
});

resetSettingsButton.addEventListener('click', () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  appliedSettings = normalizeLifeSettings(null, browserTimeZone());
  syncSettingsInputs(appliedSettings);
  settingsError.textContent = '';
  settingsFeedback.textContent = 'Life settings reset to the 6.am palette and your browser time zone.';
  render();
});

form.addEventListener('input', scheduleRender);
form.addEventListener('change', () => { customSize.hidden = deviceSelect.value !== 'custom'; scheduleRender(); });
preview.addEventListener('load', () => { previewLoading.hidden = true; });
preview.addEventListener('error', () => {
  previewLoading.hidden = true;
  errorOutput.textContent = 'The wallpaper could not be rendered. Check the settings and try again.';
});
copyButton.addEventListener('click', () => copyText(currentWallpaperUrl, 'Wallpaper URL copied.'));
downloadButton.addEventListener('click', async () => {
  if (!currentWallpaperUrl) return;
  feedback.textContent = 'Preparing download…';
  try {
    const response = await fetch(currentWallpaperUrl);
    if (!response.ok) throw new Error('Wallpaper request failed.');
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = '6am-life-wallpaper.png';
    link.click();
    URL.revokeObjectURL(objectUrl);
    feedback.textContent = 'Wallpaper downloaded.';
  } catch (error) {
    feedback.textContent = error instanceof Error ? error.message : 'Download failed.';
  }
});

installButton.addEventListener('click', () => {
  platformChoice.hidden = false;
  installSteps.hidden = true;
  installFeedback.textContent = '';
  dialog.showModal();
});
dialogClose.addEventListener('click', () => dialog.close());
installBack.addEventListener('click', () => {
  installSteps.hidden = true;
  platformChoice.hidden = false;
  /** @type {HTMLButtonElement} */ (element('[data-platform="ios"]')).focus();
});
document.querySelectorAll('[data-platform]').forEach((item) => {
  const button = /** @type {HTMLButtonElement} */ (item);
  button.addEventListener('click', () => {
    if (button.dataset.platform === 'ios' || button.dataset.platform === 'android') showPlatform(button.dataset.platform);
  });
});
copyInstallUrl.addEventListener('click', () => copyText(currentWallpaperUrl, 'Wallpaper URL copied.', installFeedback));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

setDefaults();
populateTimeZones();
restoreQuery();
updateControls();
