const $ = selector => document.querySelector(selector);
const pad = number => String(number).padStart(2, '0');
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const labels = { focus: 'Фокус', short: 'Короткий отдых', long: 'Длинный отдых' };
const codes = { clock: 'TIME / 01', stopwatch: 'MEASURE / 02', pomodoro: 'FOCUS / 03', settings: 'SET / 04' };
const validPomodoro = settings => settings && [settings.focus, settings.short, settings.long].every(value => Number.isInteger(value) && value >= 1 && value <= 180) && Number.isInteger(settings.cycles) && settings.cycles >= 1 && settings.cycles <= 12 && typeof settings.sound === 'boolean' && typeof settings.autoStart === 'boolean';
const isValidTimeZone = timeZone => {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone }); return true; } catch { return false; }
};
const defaults = { focus: 25, short: 5, long: 15, cycles: 4, sound: true, autoStart: false, clockFormat24: true, timeZone: browserTimeZone, timeZoneLabel: '' };
const normalizeSettings = saved => {
  if (!validPomodoro(saved)) return { ...defaults };
  return {
    ...defaults,
    focus: saved.focus,
    short: saved.short,
    long: saved.long,
    cycles: saved.cycles,
    sound: saved.sound,
    autoStart: saved.autoStart,
    clockFormat24: typeof saved.clockFormat24 === 'boolean' ? saved.clockFormat24 : defaults.clockFormat24,
    timeZone: isValidTimeZone(saved.timeZone) ? saved.timeZone : browserTimeZone,
    timeZoneLabel: typeof saved.timeZoneLabel === 'string' ? saved.timeZoneLabel.trim().slice(0, 80) : ''
  };
};

let settings = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem('6am-preferences') || localStorage.getItem('winter-arc-preferences') || 'null');
  settings = normalizeSettings(saved);
} catch {}

let supportedTimeZones = [];
try { supportedTimeZones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []; } catch {}
supportedTimeZones = [...new Set([...supportedTimeZones, settings.timeZone, browserTimeZone, 'UTC'])].filter(isValidTimeZone).sort((left, right) => left.localeCompare(right));

const duration = phase => settings[phase] * 60000;
const countdown = milliseconds => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};
const elapsed = (stopwatch, now = Date.now()) => stopwatch.accumulated + (stopwatch.startedAt === null ? 0 : Math.max(0, now - stopwatch.startedAt));
const elapsedText = milliseconds => {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
};
const state = {
  view: codes[location.hash.slice(1)] ? location.hash.slice(1) : 'clock',
  now: Date.now(),
  pomodoro: { phase: 'focus', remaining: duration('focus'), deadline: null, completed: 0, notice: '' },
  stopwatch: { accumulated: 0, startedAt: null, laps: [] }
};

let audio = null;
let stopwatchFrame = 0;
const resetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/></svg>';
const lapIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';

$('#pomodoro-reset').innerHTML = resetIcon;
$('#stopwatch-reset').innerHTML = resetIcon;
$('#stopwatch-lap').innerHTML = lapIcon;

function saveSettings() {
  try { localStorage.setItem('6am-preferences', JSON.stringify(settings)); } catch {}
}

function populateTimeZones() {
  const select = $('#time-zone-select');
  select.replaceChildren();
  supportedTimeZones.forEach(timeZone => {
    const option = document.createElement('option');
    option.value = timeZone;
    option.textContent = timeZone;
    select.append(option);
  });
}

function syncClockSettings() {
  $('#clock-format').checked = settings.clockFormat24;
  $('#time-zone-select').value = settings.timeZone;
  $('#time-zone-label').value = settings.timeZoneLabel;
}

function updateStopwatch() {
  if (state.stopwatch.startedAt === null) { stopwatchFrame = 0; return; }
  renderStopwatch();
  stopwatchFrame = requestAnimationFrame(updateStopwatch);
}

function startStopwatchFrame() { if (!stopwatchFrame) stopwatchFrame = requestAnimationFrame(updateStopwatch); }

function status(element, text, running) {
  element.classList.toggle('running', running);
  element.innerHTML = `<i></i>${text}`;
}

function sound() {
  if (!settings.sound || !audio) return;
  [0, .25, .5].forEach(offset => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 660;
    const start = audio.currentTime + offset;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(.13, start + .015);
    gain.gain.exponentialRampToValueAtTime(.001, start + .2);
    oscillator.start(start);
    oscillator.stop(start + .22);
  });
}

function enableAudio() {
  try { audio ||= new AudioContext(); audio.resume(); } catch { $('#settings-error').textContent = 'Звук недоступен. Завершение появится на экране.'; }
}

function advance(now) {
  const timer = state.pomodoro;
  if (timer.deadline === null) return 0;
  let count = 0;
  while (timer.deadline <= now && count < 100) {
    const focus = timer.phase === 'focus';
    timer.completed += focus ? 1 : 0;
    timer.phase = focus ? (timer.completed % settings.cycles === 0 ? 'long' : 'short') : 'focus';
    timer.remaining = duration(timer.phase);
    timer.notice = focus ? 'Сессия завершена. Время отдохнуть.' : 'Отдых завершён. Можно возвращаться к работе.';
    count++;
    timer.deadline = settings.autoStart ? timer.deadline + duration(timer.phase) : null;
  }
  if (timer.deadline !== null) timer.remaining = Math.max(0, timer.deadline - now);
  return count;
}

function tabs() {
  document.querySelectorAll('[data-view]').forEach(tab => {
    const active = tab.dataset.view === state.view;
    tab.setAttribute('aria-selected', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== state.view);
  $('#section-code').textContent = codes[state.view];
  $('[data-running="stopwatch"]').hidden = state.stopwatch.startedAt === null;
  $('[data-running="pomodoro"]').hidden = state.pomodoro.deadline === null;
}

function renderPomodoro() {
  const timer = state.pomodoro;
  const running = timer.deadline !== null;
  const total = duration(timer.phase);
  const progress = Math.min(100, Math.max(0, 100 * (1 - timer.remaining / total)));
  const remaining = countdown(timer.remaining);
  const done = timer.completed % settings.cycles;
  const visible = timer.phase === 'long' && done === 0 && timer.completed > 0 ? settings.cycles : done;
  const session = timer.phase === 'focus' ? done + 1 : done || settings.cycles;
  status($('#pomodoro-status'), running ? 'Идёт отсчёт' : timer.remaining < total ? 'На паузе' : 'Готов к старту', running);
  $('#pomodoro-heading').textContent = timer.phase === 'focus' ? 'Время сосредоточиться.' : 'Пауза тоже часть работы.';
  $('#pomodoro-digits').innerHTML = `${remaining.split(':')[0]}<span>:</span>${remaining.split(':')[1]}`;
  $('#pomodoro-digits').setAttribute('aria-label', `Осталось ${remaining}`);
  $('#session-label').innerHTML = `СЕССИЯ ${pad(session)} <span>/ ${pad(settings.cycles)}</span>`;
  $('#pomodoro-toggle').innerHTML = `<span>${running ? 'Пауза' : timer.remaining < total ? 'Продолжить' : timer.phase === 'focus' ? 'Начать фокус' : 'Начать отдых'}</span>`;
  $('#pomodoro-notice').textContent = timer.notice;
  $('#progress-label').textContent = labels[timer.phase];
  $('#progress-value').textContent = `${settings[timer.phase]} мин · ${Math.floor(progress)}%`;
  $('#progress-indicator').style.width = `${progress}%`;
  $('#session-marks').setAttribute('aria-label', `Завершено в цикле: ${visible} из ${settings.cycles}`);
  $('#session-marks').innerHTML = Array.from({ length: settings.cycles }, (_, index) => `<b class="${index < visible ? 'complete' : ''}"></b>`).join('');
  document.querySelectorAll('[data-phase]').forEach(button => button.classList.toggle('selected', button.dataset.phase === timer.phase));
  document.title = running ? `${remaining} · ${labels[timer.phase]} — 6.am` : '6.am — Время';
}

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  if (hour < 22) return 'Good evening.';
  return 'Good night.';
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
  $('#clock-rule').innerHTML = Array.from({ length: 60 }, (_, index) => `<i class="${index <= Number(parts.second) ? 'elapsed' : ''}"></i>`).join('');
}

function renderStopwatch() {
  const time = elapsed(state.stopwatch);
  const running = state.stopwatch.startedAt !== null;
  status($('#stopwatch-status'), running ? 'Идёт отсчёт' : time ? 'На паузе' : 'Готов к старту', running);
  $('#stopwatch-digits').innerHTML = `${elapsedText(time)}<small class="hundredths">.${pad(Math.floor(time % 1000 / 10))}</small>`;
  $('#stopwatch-toggle').innerHTML = `<span>${running ? 'Пауза' : time ? 'Продолжить' : 'Начать'}</span>`;
  $('#stopwatch-reset').disabled = time === 0;
  $('#stopwatch-lap').disabled = !running || state.stopwatch.laps.length >= 100;
  $('#laps-empty').hidden = state.stopwatch.laps.length > 0;
  $('#laps').hidden = state.stopwatch.laps.length === 0;
  $('#laps-body').innerHTML = state.stopwatch.laps.map((lap, index) => {
    const previous = state.stopwatch.laps[index - 1] || 0;
    return `<tr><td>${pad(index + 1)}</td><td>${elapsedText(lap - previous)}.${pad(Math.floor((lap - previous) % 1000 / 10))}</td><td>${elapsedText(lap)}.${pad(Math.floor(lap % 1000 / 10))}</td></tr>`;
  }).reverse().join('');
}

function render() { tabs(); renderPomodoro(); renderClock(); renderStopwatch(); }

document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => {
  if (!codes[tab.dataset.view]) return;
  state.view = tab.dataset.view;
  history.replaceState(null, '', `#${state.view}`);
  tabs();
}));
window.addEventListener('hashchange', () => {
  if (!codes[location.hash.slice(1)]) return;
  state.view = location.hash.slice(1);
  tabs();
});
document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => {
  state.pomodoro.phase = button.dataset.phase;
  state.pomodoro.remaining = duration(state.pomodoro.phase);
  state.pomodoro.deadline = null;
  state.pomodoro.notice = '';
  render();
}));
$('#pomodoro-toggle').addEventListener('click', () => {
  const now = Date.now();
  if (state.pomodoro.deadline !== null) {
    state.pomodoro.remaining = Math.max(0, state.pomodoro.deadline - now);
    state.pomodoro.deadline = null;
  } else {
    if (settings.sound) enableAudio();
    state.pomodoro.deadline = now + state.pomodoro.remaining;
    state.pomodoro.notice = '';
  }
  render();
});
$('#pomodoro-reset').addEventListener('click', () => {
  state.pomodoro.remaining = duration(state.pomodoro.phase);
  state.pomodoro.deadline = null;
  state.pomodoro.notice = '';
  render();
});
$('#stopwatch-toggle').addEventListener('click', () => {
  if (state.stopwatch.startedAt !== null) {
    state.stopwatch.accumulated = elapsed(state.stopwatch);
    state.stopwatch.startedAt = null;
  } else {
    state.stopwatch.startedAt = Date.now();
    startStopwatchFrame();
  }
  render();
});
$('#stopwatch-reset').addEventListener('click', () => { state.stopwatch = { accumulated: 0, startedAt: null, laps: [] }; render(); });
$('#stopwatch-lap').addEventListener('click', () => {
  if (state.stopwatch.startedAt !== null && state.stopwatch.laps.length < 100) {
    state.stopwatch.laps.push(elapsed(state.stopwatch));
    renderStopwatch();
  }
});
$('#clock-format').addEventListener('change', () => {
  settings = { ...settings, clockFormat24: $('#clock-format').checked };
  renderClock();
});
$('#clock-settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const timeZone = $('#time-zone-select').value;
  $('#clock-settings-error').textContent = '';
  if (!isValidTimeZone(timeZone)) {
    $('#clock-settings-error').textContent = 'Выбери доступный часовой пояс.';
    return;
  }
  settings = { ...settings, clockFormat24: $('#clock-format').checked, timeZone, timeZoneLabel: $('#time-zone-label').value.trim().slice(0, 80) };
  saveSettings();
  $('#clock-settings-feedback').textContent = 'Настройки часов сохранены на этом устройстве.';
  renderClock();
});
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const next = { ...settings, focus: Number($('#focus-input').value), short: Number($('#short-input').value), long: Number($('#long-input').value), cycles: Number($('#cycles-input').value), sound: $('#sound-input').checked, autoStart: $('#auto-start-input').checked };
  $('#settings-error').textContent = '';
  if (!validPomodoro(next)) {
    $('#settings-error').textContent = 'Укажи целые минуты от 1 до 180 и число сессий от 1 до 12.';
    return;
  }
  settings = next;
  state.pomodoro = { phase: 'focus', remaining: duration('focus'), deadline: null, completed: 0, notice: '' };
  saveSettings();
  $('#settings-feedback').textContent = 'Настройки сохранены на этом устройстве.';
  render();
});

[['focus', 'focus-input'], ['short', 'short-input'], ['long', 'long-input'], ['cycles', 'cycles-input']].forEach(([key, id]) => { $(`#${id}`).value = settings[key]; });
$('#sound-input').checked = settings.sound;
$('#auto-start-input').checked = settings.autoStart;
populateTimeZones();
syncClockSettings();
document.addEventListener('visibilitychange', () => {
  state.now = Date.now();
  const completed = advance(state.now);
  if (completed && settings.sound) sound();
  render();
  if (state.stopwatch.startedAt !== null) startStopwatchFrame();
});
setInterval(() => {
  state.now = Date.now();
  const completed = advance(state.now);
  if (completed && settings.sound) sound();
  tabs();
  renderPomodoro();
  renderClock();
}, 250);
render();
