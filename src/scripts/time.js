// @ts-check

import {
  advancePomodoro,
  buildTimeZones,
  createRuntime,
  duration,
  elapsed,
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
const labels = /** @type {Record<Phase, string>} */ ({ focus: 'Фокус', short: 'Короткий отдых', long: 'Длинный отдых' });
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

/** @type {AudioContext | null} */
let audio = null;
let stopwatchFrame = 0;
let tickTimer = 0;
let lastClockSecond = -1;
let lastClockRuleSecond = -1;
let lastPomodoroSecond = -1;
const resetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/></svg>';
const lapIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';

$('#pomodoro-reset').innerHTML = resetIcon;
$('#stopwatch-reset').innerHTML = resetIcon;
$('#stopwatch-lap').innerHTML = lapIcon;

function persistRuntime() {
  return saveJson(localStorage, runtimeKey, runtimeSnapshot({ pomodoro: state.pomodoro, stopwatch: state.stopwatch }));
}

function saveSettings() {
  return saveJson(localStorage, preferencesKey, settings);
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

/** @param {HTMLElement} element @param {string} text @param {boolean} running */
function setStatus(element, text, running) {
  element.classList.toggle('running', running);
  const dot = element.querySelector('i') || document.createElement('i');
  element.replaceChildren(dot, document.createTextNode(text));
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
    document.title = '6.am — Время';
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

function renderPhaseButtons() {
  document.querySelectorAll('[data-phase]').forEach((element) => {
    const button = /** @type {HTMLButtonElement} */ (element);
    const selected = button.dataset.phase === state.pomodoro.phase;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

/** @param {number} visible */
function renderSessionMarks(visible) {
  const marks = $('#session-marks');
  if (marks.childElementCount !== settings.cycles) {
    marks.replaceChildren(...Array.from({ length: settings.cycles }, () => document.createElement('b')));
  }
  [...marks.children].forEach((mark, index) => mark.classList.toggle('complete', index < visible));
}

function renderPomodoro() {
  const timer = state.pomodoro;
  const running = timer.deadline !== null;
  const total = duration(settings, timer.phase);
  const progress = Math.min(100, Math.max(0, 100 * (1 - timer.remaining / total)));
  const remaining = countdown(timer.remaining);
  const done = timer.completed % settings.cycles;
  const visible = timer.phase === 'long' && done === 0 && timer.completed > 0 ? settings.cycles : done;
  const session = timer.phase === 'focus' ? done + 1 : done || settings.cycles;
  setStatus(/** @type {HTMLElement} */ ($('#pomodoro-status')), running ? 'Идёт отсчёт' : timer.remaining < total ? 'На паузе' : 'Готов к старту', running);
  $('#pomodoro-heading').textContent = timer.phase === 'focus' ? 'Время сосредоточиться.' : 'Пауза тоже часть работы.';
  $('#pomodoro-digits').innerHTML = `${remaining.split(':')[0]}<span>:</span>${remaining.split(':')[1]}`;
  $('#pomodoro-digits').setAttribute('aria-label', `Осталось ${remaining}`);
  $('#session-label').innerHTML = `СЕССИЯ ${pad(session)} <span>/ ${pad(settings.cycles)}</span>`;
  $('#pomodoro-toggle').innerHTML = `<span>${running ? 'Пауза' : timer.remaining < total ? 'Продолжить' : timer.phase === 'focus' ? 'Начать фокус' : 'Начать отдых'}</span>`;
  $('#pomodoro-notice').textContent = timer.notice;
  $('#progress-label').textContent = labels[timer.phase];
  $('#progress-value').textContent = `${settings[timer.phase]} мин · ${Math.floor(progress)}%`;
  /** @type {HTMLElement} */ ($('#progress-indicator')).style.width = `${progress}%`;
  $('#session-marks').setAttribute('aria-label', `Завершено в цикле: ${visible} из ${settings.cycles}`);
  renderSessionMarks(visible);
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
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !settings.clockFormat24 }).format(date);
  $('#clock-heading').textContent = greeting(Number(parts.hour));
  $('#clock-digits').textContent = time;
  $('#clock-digits').setAttribute('aria-label', time);
  $('#date-label').textContent = new Intl.DateTimeFormat('ru-RU', { timeZone: settings.timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
  setStatus(/** @type {HTMLElement} */ ($('#stopwatch-status')), running ? 'Идёт отсчёт' : time ? 'На паузе' : 'Готов к старту', running);
  renderStopwatchTime();
  $('#stopwatch-toggle').innerHTML = `<span>${running ? 'Пауза' : time ? 'Продолжить' : 'Начать'}</span>`;
  /** @type {HTMLButtonElement} */ ($('#stopwatch-reset')).disabled = time === 0;
  /** @type {HTMLButtonElement} */ ($('#stopwatch-lap')).disabled = !running || state.stopwatch.laps.length >= 100;
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

function playCompletionSound() {
  if (!settings.sound || !audio) return;
  const context = audio;
  try {
    [0, .25, .5].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.frequency.value = 660;
      const start = context.currentTime + offset;
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(.13, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .2);
      oscillator.start(start);
      oscillator.stop(start + .22);
    });
  } catch {
    state.pomodoro.notice = 'Звук недоступен. Завершение этапа показано на экране.';
  }
}

async function enableAudio() {
  if (!settings.sound) return true;
  try {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return false;
    audio ||= new AudioContextConstructor();
    if (audio.state === 'suspended') await audio.resume();
    return audio.state !== 'closed';
  } catch {
    audio = null;
    return false;
  }
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
    if (state.pomodoro.deadline !== null && !window.confirm('Сменить этап и сбросить текущий прогресс?')) return;
    state.pomodoro = { phase, remaining: duration(settings, phase), deadline: null, completed: state.pomodoro.completed, notice: '' };
    persistRuntime();
    renderTabs();
    renderPomodoro();
    scheduleTick();
  });
});

$('#pomodoro-toggle').addEventListener('click', async () => {
  const button = /** @type {HTMLButtonElement} */ ($('#pomodoro-toggle'));
  const now = Date.now();
  if (state.pomodoro.deadline !== null) {
    state.pomodoro.remaining = Math.max(0, state.pomodoro.deadline - now);
    state.pomodoro.deadline = null;
  } else {
    button.disabled = true;
    const audioReady = await enableAudio();
    button.disabled = false;
    state.pomodoro.deadline = Date.now() + state.pomodoro.remaining;
    state.pomodoro.notice = audioReady ? '' : 'Звук недоступен. Таймер продолжит работу без сигнала.';
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
    $('#clock-settings-error').textContent = 'Введи корректный часовой пояс IANA, например Europe/Moscow.';
    return;
  }
  settings = {
    ...settings,
    clockFormat24: /** @type {HTMLInputElement} */ ($('#clock-format')).checked,
    timeZone,
    timeZoneLabel: /** @type {HTMLInputElement} */ ($('#time-zone-label')).value.trim().slice(0, 80)
  };
  if (saveSettings()) {
    $('#clock-settings-feedback').textContent = 'Настройки часов сохранены на этом устройстве.';
  } else {
    $('#clock-settings-error').textContent = 'Не удалось сохранить настройки. Они действуют только до закрытия страницы.';
  }
  state.now = Date.now();
  renderClock();
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
    autoStart: /** @type {HTMLInputElement} */ ($('#auto-start-input')).checked
  };
  $('#settings-error').textContent = '';
  $('#settings-feedback').textContent = '';
  if (!validPomodoroSettings(next)) {
    $('#settings-error').textContent = 'Укажи целые минуты от 1 до 180 и число сессий от 1 до 12.';
    return;
  }
  settings = /** @type {Settings} */ (next);
  state.pomodoro = createRuntime(settings).pomodoro;
  persistRuntime();
  if (saveSettings()) {
    $('#settings-feedback').textContent = 'Настройки сохранены на этом устройстве.';
  } else {
    $('#settings-error').textContent = 'Не удалось сохранить настройки. Они действуют только до закрытия страницы.';
  }
  renderTabs();
  if (state.view === 'pomodoro') renderPomodoro();
  scheduleTick();
});

/** @type {Array<[keyof Settings, string]>} */
const settingInputs = [['focus', 'focus-input'], ['short', 'short-input'], ['long', 'long-input'], ['cycles', 'cycles-input']];
settingInputs.forEach(([key, id]) => { /** @type {HTMLInputElement} */ ($(`#${id}`)).value = String(settings[key]); });
/** @type {HTMLInputElement} */ ($('#sound-input')).checked = settings.sound;
/** @type {HTMLInputElement} */ ($('#auto-start-input')).checked = settings.autoStart;
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
