// @ts-check

import {
  advancePomodoro,
  buildTimeZones,
  createRuntime,
  duration,
  elapsed,
  isValidSoundId,
  isValidTimeZone,
  normalizeRuntime,
  normalizeSettings,
  runtimeSnapshot,
  saveJson,
  validPomodoroSettings
} from './time-domain.js';

/** @typedef {import('./time-domain.js').Settings} Settings */
/** @typedef {import('./time-domain.js').Phase} Phase */
/** @typedef {'clock' | 'stopwatch' | 'pomodoro' | 'settings'} View */

/** @template {Element} T @param {string} selector @returns {T} */
function $(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return /** @type {T} */ (element);
}

const pad = (/** @type {number} */ number) => String(number).padStart(2, '0');
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const labels = /** @type {Record<Phase, string>} */ ({ focus: 'Focus', short: 'Short break', long: 'Long break' });
const codes = /** @type {Record<View, string>} */ ({ clock: 'TIME / 01', stopwatch: 'MEASURE / 02', pomodoro: 'FOCUS / 03', settings: 'SET / 04' });
const preferencesKey = '6am-preferences';
const runtimeKey = '6am-runtime';

/** @param {string} key */
function readStoredJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

const savedPreferences = readStoredJson(preferencesKey) ?? readStoredJson('winter-arc-preferences');
/** @type {Settings} */
let settings = normalizeSettings(savedPreferences, browserTimeZone);
const restored = normalizeRuntime(readStoredJson(runtimeKey), settings);

const hashView = location.hash.slice(1);
const state = {
  view: /** @type {View} */ (Object.hasOwn(codes, hashView) ? hashView : 'clock'),
  now: Date.now(),
  pomodoro: restored.runtime.pomodoro,
  stopwatch: restored.runtime.stopwatch
};

/** @type {HTMLAudioElement | null} */
let alertPlayer = null;
let customSoundUrl = '';
let customSoundName = settings.customSoundName;
let stopwatchFrame = 0;
let tickTimer = 0;
let lastClockSecond = -1;
let lastClockRuleSecond = -1;
let lastPomodoroSecond = -1;
let fallbackPresentation = false;
const resetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/></svg>';
const lapIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4m0 1c4-2 7 2 12 0v9c-5 2-8-2-12 0"/></svg>';

$('#pomodoro-reset').innerHTML = resetIcon;
$('#stopwatch-reset').innerHTML = resetIcon;
$('#stopwatch-lap').innerHTML = lapIcon;

function persistRuntime() {
  return saveJson(localStorage, runtimeKey, runtimeSnapshot({ pomodoro: state.pomodoro, stopwatch: state.stopwatch }));
}

function saveSettings() {
  return saveJson(localStorage, preferencesKey, settings);
}

function openSoundDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open('6am-sounds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('audio');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @param {File} file */
async function storeCustomSound(file) {
  const database = /** @type {IDBDatabase} */ (await openSoundDatabase());
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('audio', 'readwrite');
    transaction.objectStore('audio').put({ blob: file, name: file.name }, 'custom');
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

async function readCustomSound() {
  const database = /** @type {IDBDatabase} */ (await openSoundDatabase());
  const record = await new Promise((resolve, reject) => {
    const request = database.transaction('audio').objectStore('audio').get('custom');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return /** @type {{ blob?: Blob, name?: string } | undefined} */ (record);
}

/** @param {Blob} blob @param {string} name */
function useCustomSound(blob, name) {
  if (customSoundUrl) URL.revokeObjectURL(customSoundUrl);
  customSoundUrl = URL.createObjectURL(blob);
  customSoundName = name.slice(0, 120);
  document.querySelectorAll('option[data-custom-sound]').forEach((option) => option.remove());
  ['focus-sound-input', 'break-sound-input'].forEach((id) => {
    const option = document.createElement('option');
    option.value = 'custom';
    option.dataset.customSound = '';
    option.textContent = `Custom — ${customSoundName}`;
    $(`#${id}`).append(option);
  });
  $('#custom-sound-name').textContent = `${customSoundName} · stored on this device`;
}

function syncSoundControls() {
  /** @type {HTMLInputElement} */ ($('#sound-input')).checked = settings.sound;
  /** @type {HTMLSelectElement} */ ($('#focus-sound-input')).value = settings.focusSound === 'custom' && !customSoundUrl ? 'chime' : settings.focusSound;
  /** @type {HTMLSelectElement} */ ($('#break-sound-input')).value = settings.breakSound === 'custom' && !customSoundUrl ? 'bell' : settings.breakSound;
  /** @type {HTMLInputElement} */ ($('#sound-volume-input')).value = String(settings.soundVolume);
  $('#sound-volume-value').textContent = `${settings.soundVolume}%`;
  const controls = [...$('#sound-settings').querySelectorAll('input, select, button')];
  controls.forEach((element) => { /** @type {HTMLInputElement | HTMLSelectElement | HTMLButtonElement} */ (element).disabled = !settings.sound; });
  $('#sound-settings').classList.toggle('is-disabled', !settings.sound);
}

async function restoreCustomSound() {
  try {
    const record = await readCustomSound();
    if (record?.blob instanceof Blob && record.name) {
      useCustomSound(record.blob, record.name);
      syncSoundControls();
    }
  } catch {}
}

/** @returns {string[]} */
function browserSupportedTimeZones() {
  try {
    const supportedValuesOf = /** @type {{ supportedValuesOf?: (key: 'timeZone') => string[] }} */ (Intl).supportedValuesOf;
    return supportedValuesOf ? supportedValuesOf('timeZone') : [];
  } catch {
    return [];
  }
}

const supportedTimeZones = buildTimeZones(browserSupportedTimeZones(), settings.timeZone, browserTimeZone);

/** @param {string} timeZone */
function timeZoneOptionLabel(timeZone) {
  const parts = timeZone.split('/');
  const city = (parts.at(-1) || timeZone).replaceAll('_', ' ');
  const region = parts.length > 1 ? parts[0] : 'Universal';
  let offset = 'UTC';
  try {
    const zoneName = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    if (zoneName) offset = zoneName.replace('GMT', 'UTC');
  } catch {}
  return `${city} — ${region} · ${offset}`;
}

function populateTimeZones() {
  const datalist = /** @type {HTMLDataListElement} */ ($('#time-zone-options'));
  const options = supportedTimeZones.map((timeZone) => {
    const option = document.createElement('option');
    option.value = timeZone;
    option.label = timeZoneOptionLabel(timeZone);
    return option;
  });
  datalist.replaceChildren(...options);
}

function syncClockSettings() {
  /** @type {HTMLInputElement} */ ($('#clock-format')).checked = settings.clockFormat24;
  /** @type {HTMLInputElement} */ ($('#time-zone-input')).value = settings.timeZone;
  /** @type {HTMLInputElement} */ ($('#time-zone-label')).value = settings.timeZoneLabel;
}

/** @param {number} milliseconds */
function countdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function updateDocumentTitle() {
  if (state.pomodoro.deadline !== null) {
    const remaining = countdown(state.pomodoro.remaining);
    document.title = `${remaining} · ${labels[state.pomodoro.phase]} — 6.am`;
  } else {
    document.title = '6.am — Time';
  }
}

function renderTabs() {
  document.querySelectorAll('[data-view]').forEach((element) => {
    const tab = /** @type {HTMLElement} */ (element);
    const active = tab.dataset.view === state.view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-panel]').forEach((element) => {
    const panel = /** @type {HTMLElement} */ (element);
    panel.hidden = panel.dataset.panel !== state.view;
  });
  $('#section-code').textContent = codes[state.view];
  /** @type {HTMLElement} */ ($('[data-running="stopwatch"]')).hidden = state.stopwatch.startedAt === null;
  /** @type {HTMLElement} */ ($('[data-running="pomodoro"]')).hidden = state.pomodoro.deadline === null;
}

function syncFullscreenControls() {
  const active = Boolean(document.fullscreenElement) || fallbackPresentation;
  document.documentElement.classList.toggle('time-fullscreen', active);
  document.querySelectorAll('[data-fullscreen]').forEach((element) => {
    const button = /** @type {HTMLButtonElement} */ (element);
    button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Open in fullscreen');
    button.title = active ? 'Exit fullscreen' : 'Open fullscreen';
  });
}

async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    fallbackPresentation = true;
    syncFullscreenControls();
  }
}

async function exitFullscreen() {
  fallbackPresentation = false;
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {}
  }
  syncFullscreenControls();
}

document.querySelectorAll('[data-fullscreen]').forEach((element) => {
  element.addEventListener('click', () => {
    if (document.fullscreenElement || fallbackPresentation) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  });
});

document.addEventListener('fullscreenchange', () => {
  fallbackPresentation = false;
  syncFullscreenControls();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && fallbackPresentation) {
    event.preventDefault();
    void exitFullscreen();
  }
});

function renderPhaseButtons() {
  document.querySelectorAll('[data-phase]').forEach((element) => {
    const button = /** @type {HTMLButtonElement} */ (element);
    const selected = button.dataset.phase === state.pomodoro.phase;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderPomodoro() {
  const timer = state.pomodoro;
  const running = timer.deadline !== null;
  const total = duration(settings, timer.phase);
  const progress = Math.min(100, Math.max(0, 100 * (1 - timer.remaining / total)));
  const remaining = countdown(timer.remaining);
  const done = timer.completed % settings.cycles;
  const session = timer.phase === 'focus'
    ? done + 1
    : (timer.phase === 'long' && done === 0 && timer.completed > 0 ? settings.cycles : Math.max(1, done));
  $('#pomodoro-heading').textContent = timer.phase === 'focus' ? 'Time to focus.' : 'A break is part of the work.';
  $('#pomodoro-digits').innerHTML = `${remaining.split(':')[0]}<span>:</span>${remaining.split(':')[1]}`;
  $('#pomodoro-digits').setAttribute('aria-label', `${remaining} remaining`);
  $('#session-label').innerHTML = `SESSION ${pad(session)} <span>/ ${pad(settings.cycles)}</span>`;
  $('#pomodoro-toggle').innerHTML = `<span>${running ? 'Pause' : timer.remaining < total ? 'Resume' : timer.phase === 'focus' ? 'Start focus' : 'Start break'}</span>`;
  $('#pomodoro-notice').textContent = timer.notice;
  $('#progress-label').textContent = labels[timer.phase];
  $('#progress-value').textContent = `${settings[timer.phase]} min · ${Math.floor(progress)}%`;
  /** @type {HTMLElement} */ ($('#progress-indicator')).style.width = `${progress}%`;
  renderPhaseButtons();
  updateDocumentTitle();
}

/** @param {Date} date */
function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

/** @param {number} hour */
function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  if (hour < 22) return 'Good evening.';
  return 'Good night.';
}

function initializeClockRule() {
  $('#clock-rule').replaceChildren(...Array.from({ length: 60 }, () => document.createElement('i')));
}

function renderClock() {
  const date = new Date(state.now);
  const parts = zonedParts(date);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !settings.clockFormat24 }).format(date);
  $('#clock-heading').textContent = greeting(Number(parts.hour));
  $('#clock-digits').textContent = time;
  $('#clock-digits').setAttribute('aria-label', time);
  $('#date-label').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  $('#time-zone').textContent = settings.timeZoneLabel || settings.timeZone.replaceAll('_', ' ');
  const second = Number(parts.second);
  const marks = [...$('#clock-rule').children];
  if (lastClockRuleSecond < 0 || second < lastClockRuleSecond) {
    marks.forEach((mark, index) => mark.classList.toggle('elapsed', index <= second));
  } else {
    for (let index = lastClockRuleSecond + 1; index <= second; index += 1) marks[index]?.classList.add('elapsed');
  }
  lastClockRuleSecond = second;
}

/** @param {number} milliseconds */
function elapsedText(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function renderStopwatchTime() {
  const time = elapsed(state.stopwatch);
  $('#stopwatch-digits').innerHTML = `${elapsedText(time)}<small class="hundredths">.${pad(Math.floor(time % 1000 / 10))}</small>`;
}

function renderLaps() {
  const laps = state.stopwatch.laps;
  /** @type {HTMLElement} */ ($('#laps-empty')).hidden = laps.length > 0;
  /** @type {HTMLElement} */ ($('#laps')).hidden = laps.length === 0;
  $('#laps-body').innerHTML = laps.map((lap, index) => {
    const previous = laps[index - 1] || 0;
    const lapTime = lap - previous;
    return `<tr><td>${pad(index + 1)}</td><td>${elapsedText(lapTime)}.${pad(Math.floor(lapTime % 1000 / 10))}</td><td>${elapsedText(lap)}.${pad(Math.floor(lap % 1000 / 10))}</td></tr>`;
  }).reverse().join('');
}

function renderStopwatch() {
  const time = elapsed(state.stopwatch);
  const running = state.stopwatch.startedAt !== null;
  renderStopwatchTime();
  $('#stopwatch-toggle').innerHTML = `<span>${running ? 'Pause' : time ? 'Resume' : 'Start'}</span>`;
  /** @type {HTMLButtonElement} */ ($('#stopwatch-reset')).disabled = time === 0;
  /** @type {HTMLButtonElement} */ ($('#stopwatch-lap')).disabled = !running || state.stopwatch.laps.length >= 100;
  const actionGroup = /** @type {HTMLElement} */ ($('#stopwatch-actions'));
  actionGroup.classList.toggle('is-initial', !running && time === 0);
  actionGroup.classList.toggle('is-running', running);
  actionGroup.classList.toggle('is-paused', !running && time > 0);
  renderLaps();
}

function stopStopwatchFrame() {
  if (stopwatchFrame) cancelAnimationFrame(stopwatchFrame);
  stopwatchFrame = 0;
}

function updateStopwatchFrame() {
  if (document.hidden || state.view !== 'stopwatch' || state.stopwatch.startedAt === null) {
    stopwatchFrame = 0;
    return;
  }
  renderStopwatchTime();
  stopwatchFrame = requestAnimationFrame(updateStopwatchFrame);
}

function startStopwatchFrame() {
  if (!stopwatchFrame && !document.hidden && state.view === 'stopwatch' && state.stopwatch.startedAt !== null) {
    stopwatchFrame = requestAnimationFrame(updateStopwatchFrame);
  }
}

const soundFiles = {
  chime: 'sounds/soft-chime.wav',
  bell: 'sounds/glass-bell.wav',
  digital: 'sounds/digital-pulse.wav'
};

/** @param {Settings['focusSound']} soundId */
function soundUrl(soundId) {
  if (soundId === 'custom') return customSoundUrl;
  const baseUrl = new URL(import.meta.env.BASE_URL, location.origin);
  return new URL(soundFiles[soundId], baseUrl).href;
}

function getAlertPlayer() {
  alertPlayer ||= new Audio();
  alertPlayer.preload = 'auto';
  return alertPlayer;
}

/** @param {Settings['focusSound']} soundId */
async function playAlertSound(soundId) {
  if (!settings.sound) return true;
  const source = soundUrl(soundId);
  if (!source) return false;
  try {
    const player = getAlertPlayer();
    player.pause();
    player.src = source;
    player.currentTime = 0;
    player.volume = settings.soundVolume / 100;
    await player.play();
    return true;
  } catch {
    return false;
  }
}

function primeAlertSound() {
  if (!settings.sound) return;
  const soundId = state.pomodoro.phase === 'focus' ? settings.focusSound : settings.breakSound;
  const source = soundUrl(soundId);
  if (!source) return;
  try {
    const player = getAlertPlayer();
    player.src = source;
    player.volume = 0;
    const attempt = player.play();
    void attempt.then(() => {
      player.pause();
      player.currentTime = 0;
      player.volume = settings.soundVolume / 100;
    }).catch(() => {});
  } catch {}
}

function playCompletionSound() {
  const soundId = state.pomodoro.phase === 'focus' ? settings.breakSound : settings.focusSound;
  void playAlertSound(soundId).then((played) => {
    if (played) return;
    state.pomodoro.notice = soundId === 'custom' && !customSoundUrl
      ? 'The custom sound is missing. Choose it again in Settings.'
      : 'Sound playback was blocked. The completed phase is shown on screen.';
    persistRuntime();
    if (state.view === 'pomodoro') renderPomodoro();
  });
}

/** @param {number} now */
function catchUpPomodoro(now) {
  const advanced = advancePomodoro(state.pomodoro, settings, now);
  state.pomodoro = advanced.timer;
  if (advanced.transitions) {
    persistRuntime();
    playCompletionSound();
    renderTabs();
  }
  return advanced.transitions;
}

function renderActivePanel() {
  state.now = Date.now();
  catchUpPomodoro(state.now);
  if (state.view === 'clock') renderClock();
  if (state.view === 'pomodoro') renderPomodoro();
  if (state.view === 'stopwatch') renderStopwatch();
  updateDocumentTitle();
  startStopwatchFrame();
}

function stopTicking() {
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = 0;
}

function scheduleTick() {
  stopTicking();
  if (document.hidden || (state.view !== 'clock' && state.pomodoro.deadline === null)) return;
  const delay = 1_000 - (Date.now() % 1_000) + 20;
  tickTimer = window.setTimeout(runTick, delay);
}

function runTick() {
  tickTimer = 0;
  if (document.hidden) return;
  state.now = Date.now();
  const transitions = catchUpPomodoro(state.now);
  const pomodoroSecond = Math.ceil(state.pomodoro.remaining / 1_000);
  if (state.view === 'pomodoro' && (transitions || pomodoroSecond !== lastPomodoroSecond)) {
    lastPomodoroSecond = pomodoroSecond;
    renderPomodoro();
  }
  const clockSecond = Math.floor(state.now / 1_000);
  if (state.view === 'clock' && clockSecond !== lastClockSecond) {
    lastClockSecond = clockSecond;
    renderClock();
  }
  updateDocumentTitle();
  scheduleTick();
}

/** @param {View} view @param {boolean} [updateHistory] */
function activateView(view, updateHistory = true) {
  if (state.view !== view) {
    state.view = view;
    if (updateHistory) history.replaceState(null, '', `#${view}`);
  }
  stopStopwatchFrame();
  renderTabs();
  renderActivePanel();
  scheduleTick();
}

const tabs = [...document.querySelectorAll('[data-view]')].map((element) => /** @type {HTMLAnchorElement} */ (element));
tabs.forEach((tab, tabIndex) => {
  tab.addEventListener('click', (event) => {
    const view = tab.dataset.view;
    if (!view || !Object.hasOwn(codes, view)) return;
    event.preventDefault();
    activateView(/** @type {View} */ (view));
  });
  tab.addEventListener('keydown', (event) => {
    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    activateView(/** @type {View} */ (nextTab.dataset.view));
  });
});

window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1);
  if (Object.hasOwn(codes, view)) activateView(/** @type {View} */ (view), false);
});

document.querySelectorAll('[data-phase]').forEach((element) => {
  const button = /** @type {HTMLButtonElement} */ (element);
  button.addEventListener('click', () => {
    const phase = /** @type {Phase} */ (button.dataset.phase);
    if (phase === state.pomodoro.phase) return;
    if (state.pomodoro.deadline !== null && !window.confirm('Change phase and reset current progress?')) return;
    state.pomodoro = { phase, remaining: duration(settings, phase), deadline: null, completed: state.pomodoro.completed, notice: '' };
    persistRuntime();
    renderTabs();
    renderPomodoro();
    scheduleTick();
  });
});

$('#pomodoro-toggle').addEventListener('click', () => {
  const now = Date.now();
  if (state.pomodoro.deadline !== null) {
    state.pomodoro.remaining = Math.max(0, state.pomodoro.deadline - now);
    state.pomodoro.deadline = null;
  } else {
    const deadline = now + state.pomodoro.remaining;
    state.pomodoro.deadline = deadline;
    state.pomodoro.notice = '';
    persistRuntime();
    renderTabs();
    renderPomodoro();
    scheduleTick();
    primeAlertSound();
    return;
  }
  persistRuntime();
  renderTabs();
  renderPomodoro();
  scheduleTick();
});

$('#pomodoro-reset').addEventListener('click', () => {
  state.pomodoro.remaining = duration(settings, state.pomodoro.phase);
  state.pomodoro.deadline = null;
  state.pomodoro.notice = '';
  persistRuntime();
  renderTabs();
  renderPomodoro();
  scheduleTick();
});

$('#stopwatch-toggle').addEventListener('click', () => {
  if (state.stopwatch.startedAt !== null) {
    state.stopwatch.accumulated = elapsed(state.stopwatch);
    state.stopwatch.startedAt = null;
    stopStopwatchFrame();
  } else {
    state.stopwatch.startedAt = Date.now();
  }
  persistRuntime();
  renderTabs();
  renderStopwatch();
  startStopwatchFrame();
});

$('#stopwatch-reset').addEventListener('click', () => {
  stopStopwatchFrame();
  state.stopwatch = { accumulated: 0, startedAt: null, laps: [] };
  persistRuntime();
  renderTabs();
  renderStopwatch();
});

$('#stopwatch-lap').addEventListener('click', () => {
  if (state.stopwatch.startedAt !== null && state.stopwatch.laps.length < 100) {
    state.stopwatch.laps.push(elapsed(state.stopwatch));
    persistRuntime();
    renderStopwatch();
  }
});

$('#clock-format').addEventListener('change', () => {
  settings = { ...settings, clockFormat24: /** @type {HTMLInputElement} */ ($('#clock-format')).checked };
  state.now = Date.now();
  renderClock();
});

$('#clock-settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const timeZone = /** @type {HTMLInputElement} */ ($('#time-zone-input')).value.trim();
  $('#clock-settings-error').textContent = '';
  $('#clock-settings-feedback').textContent = '';
  if (!isValidTimeZone(timeZone)) {
    $('#clock-settings-error').textContent = 'Enter a valid IANA time zone, such as Europe/Moscow.';
    return;
  }
  settings = {
    ...settings,
    clockFormat24: /** @type {HTMLInputElement} */ ($('#clock-format')).checked,
    timeZone,
    timeZoneLabel: /** @type {HTMLInputElement} */ ($('#time-zone-label')).value.trim().slice(0, 80)
  };
  if (saveSettings()) {
    $('#clock-settings-feedback').textContent = 'Clock settings were saved on this device.';
  } else {
    $('#clock-settings-error').textContent = 'Could not save settings. They will only apply until this page is closed.';
  }
  state.now = Date.now();
  renderClock();
});

$('#sound-input').addEventListener('change', () => {
  settings = { ...settings, sound: /** @type {HTMLInputElement} */ ($('#sound-input')).checked };
  syncSoundControls();
});

$('#sound-volume-input').addEventListener('input', () => {
  const soundVolume = Number(/** @type {HTMLInputElement} */ ($('#sound-volume-input')).value);
  settings = { ...settings, soundVolume };
  $('#sound-volume-value').textContent = `${soundVolume}%`;
  if (alertPlayer) alertPlayer.volume = soundVolume / 100;
});

document.querySelectorAll('[data-preview-sound]').forEach((element) => {
  element.addEventListener('click', () => {
    const kind = /** @type {HTMLButtonElement} */ (element).dataset.previewSound;
    const select = /** @type {HTMLSelectElement} */ ($(kind === 'break' ? '#break-sound-input' : '#focus-sound-input'));
    const soundId = select.value;
    if (!isValidSoundId(soundId)) return;
    void playAlertSound(soundId).then((played) => {
      $('#settings-error').textContent = played ? '' : 'Could not play this sound. Choose another file or check browser permissions.';
    });
  });
});

$('#custom-sound-input').addEventListener('change', () => {
  const input = /** @type {HTMLInputElement} */ ($('#custom-sound-input'));
  const file = input.files?.[0];
  if (!file) return;
  $('#settings-error').textContent = '';
  $('#settings-feedback').textContent = '';
  const looksLikeAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
  if (!looksLikeAudio || file.size > 5 * 1024 * 1024) {
    input.value = '';
    $('#settings-error').textContent = 'Choose an audio file no larger than 5 MB.';
    return;
  }
  useCustomSound(file, file.name);
  /** @type {HTMLSelectElement} */ ($('#focus-sound-input')).value = 'custom';
  settings = { ...settings, customSoundName: file.name };
  void storeCustomSound(file).then(() => {
    $('#settings-feedback').textContent = 'Custom sound stored on this device. Apply settings to use it.';
  }).catch(() => {
    $('#settings-feedback').textContent = 'Custom sound is ready for this tab. This browser could not store it permanently.';
  });
});

$('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const next = {
    ...settings,
    focus: Number(/** @type {HTMLInputElement} */ ($('#focus-input')).value),
    short: Number(/** @type {HTMLInputElement} */ ($('#short-input')).value),
    long: Number(/** @type {HTMLInputElement} */ ($('#long-input')).value),
    cycles: Number(/** @type {HTMLInputElement} */ ($('#cycles-input')).value),
    sound: /** @type {HTMLInputElement} */ ($('#sound-input')).checked,
    focusSound: /** @type {HTMLSelectElement} */ ($('#focus-sound-input')).value,
    breakSound: /** @type {HTMLSelectElement} */ ($('#break-sound-input')).value,
    soundVolume: Number(/** @type {HTMLInputElement} */ ($('#sound-volume-input')).value),
    customSoundName,
    autoStart: /** @type {HTMLInputElement} */ ($('#auto-start-input')).checked
  };
  $('#settings-error').textContent = '';
  $('#settings-feedback').textContent = '';
  if (!validPomodoroSettings(next) || !isValidSoundId(next.focusSound) || !isValidSoundId(next.breakSound)
    || !Number.isInteger(next.soundVolume) || next.soundVolume < 0 || next.soundVolume > 100) {
    $('#settings-error').textContent = 'Use whole minutes from 1 to 180, 1 to 12 sessions, and valid sound options.';
    return;
  }
  settings = /** @type {Settings} */ (next);
  state.pomodoro = createRuntime(settings).pomodoro;
  persistRuntime();
  if (saveSettings()) {
    $('#settings-feedback').textContent = 'Settings were saved on this device.';
  } else {
    $('#settings-error').textContent = 'Could not save settings. They will only apply until this page is closed.';
  }
  renderTabs();
  if (state.view === 'pomodoro') renderPomodoro();
  scheduleTick();
});

/** @type {Array<[keyof Settings, string]>} */
const settingInputs = [['focus', 'focus-input'], ['short', 'short-input'], ['long', 'long-input'], ['cycles', 'cycles-input']];
settingInputs.forEach(([key, id]) => { /** @type {HTMLInputElement} */ ($(`#${id}`)).value = String(settings[key]); });
/** @type {HTMLInputElement} */ ($('#auto-start-input')).checked = settings.autoStart;
syncSoundControls();
void restoreCustomSound();
populateTimeZones();
syncClockSettings();
initializeClockRule();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTicking();
    stopStopwatchFrame();
    persistRuntime();
    return;
  }
  renderTabs();
  renderActivePanel();
  scheduleTick();
});

window.addEventListener('pagehide', persistRuntime);
renderTabs();
renderActivePanel();
scheduleTick();
