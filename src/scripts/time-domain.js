// @ts-check

export const RUNTIME_VERSION = 1;
export const RUNTIME_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export const phases = ['focus', 'short', 'long'];

/** @typedef {'focus' | 'short' | 'long'} Phase */
/**
 * @typedef {object} Settings
 * @property {number} focus
 * @property {number} short
 * @property {number} long
 * @property {number} cycles
 * @property {boolean} sound
 * @property {boolean} autoStart
 * @property {boolean} clockFormat24
 * @property {string} timeZone
 * @property {string} timeZoneLabel
 */
/**
 * @typedef {object} PomodoroState
 * @property {Phase} phase
 * @property {number} remaining
 * @property {number | null} deadline
 * @property {number} completed
 * @property {string} notice
 */
/**
 * @typedef {object} StopwatchState
 * @property {number} accumulated
 * @property {number | null} startedAt
 * @property {number[]} laps
 */
/** @typedef {{ pomodoro: PomodoroState, stopwatch: StopwatchState }} RuntimeState */

/** @param {string} [browserTimeZone] @returns {Settings} */
export function createDefaults(browserTimeZone = 'UTC') {
  return {
    focus: 25,
    short: 5,
    long: 15,
    cycles: 4,
    sound: true,
    autoStart: false,
    clockFormat24: true,
    timeZone: browserTimeZone,
    timeZoneLabel: ''
  };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} timeZone */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** @param {unknown} saved */
export function validPomodoroSettings(saved) {
  if (!isRecord(saved)) return false;
  return [saved.focus, saved.short, saved.long].every((value) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 180)
    && Number.isInteger(saved.cycles) && Number(saved.cycles) >= 1 && Number(saved.cycles) <= 12
    && typeof saved.sound === 'boolean'
    && typeof saved.autoStart === 'boolean';
}

/** @param {unknown} saved @param {string} browserTimeZone @returns {Settings} */
export function normalizeSettings(saved, browserTimeZone) {
  const defaults = createDefaults(browserTimeZone);
  if (!validPomodoroSettings(saved) || !isRecord(saved)) return defaults;
  return {
    ...defaults,
    focus: Number(saved.focus),
    short: Number(saved.short),
    long: Number(saved.long),
    cycles: Number(saved.cycles),
    sound: Boolean(saved.sound),
    autoStart: Boolean(saved.autoStart),
    clockFormat24: typeof saved.clockFormat24 === 'boolean' ? saved.clockFormat24 : defaults.clockFormat24,
    timeZone: isValidTimeZone(saved.timeZone) ? String(saved.timeZone) : browserTimeZone,
    timeZoneLabel: typeof saved.timeZoneLabel === 'string' ? saved.timeZoneLabel.trim().slice(0, 80) : ''
  };
}

/** @param {Settings} settings @param {Phase} phase */
export function duration(settings, phase) {
  return settings[phase] * 60_000;
}

/** @param {Settings} settings @returns {RuntimeState} */
export function createRuntime(settings) {
  return {
    pomodoro: { phase: 'focus', remaining: duration(settings, 'focus'), deadline: null, completed: 0, notice: '' },
    stopwatch: { accumulated: 0, startedAt: null, laps: [] }
  };
}

/** @param {StopwatchState} stopwatch @param {number} [now] */
export function elapsed(stopwatch, now = Date.now()) {
  return stopwatch.accumulated + (stopwatch.startedAt === null ? 0 : Math.max(0, now - stopwatch.startedAt));
}

/**
 * @param {PomodoroState} current
 * @param {Settings} settings
 * @param {number} now
 * @returns {{ timer: PomodoroState, transitions: number }}
 */
export function advancePomodoro(current, settings, now) {
  const timer = { ...current };
  if (timer.deadline === null) return { timer, transitions: 0 };

  let transitions = 0;
  while (timer.deadline <= now) {
    const completedFocus = timer.phase === 'focus';
    timer.completed += completedFocus ? 1 : 0;
    timer.phase = completedFocus
      ? (timer.completed % settings.cycles === 0 ? 'long' : 'short')
      : 'focus';
    timer.remaining = duration(settings, timer.phase);
    timer.notice = completedFocus
      ? 'Session complete. Time for a break.'
      : 'Break complete. Ready to get back to work.';
    transitions += 1;

    if (!settings.autoStart) {
      timer.deadline = null;
      break;
    }
    timer.deadline += duration(settings, timer.phase);
  }

  if (timer.deadline !== null) timer.remaining = Math.max(0, timer.deadline - now);
  return { timer, transitions };
}

/**
 * @param {unknown} saved
 * @param {Settings} settings
 * @param {number} [now]
 * @returns {{ runtime: RuntimeState, restored: boolean, transitions: number }}
 */
export function normalizeRuntime(saved, settings, now = Date.now()) {
  const fallback = { runtime: createRuntime(settings), restored: false, transitions: 0 };
  if (!isRecord(saved) || saved.version !== RUNTIME_VERSION || !Number.isFinite(saved.savedAt)) return fallback;
  const savedAt = Number(saved.savedAt);
  if (savedAt > now + 5 * 60_000 || now - savedAt > RUNTIME_MAX_AGE) return fallback;
  if (!isRecord(saved.pomodoro) || !isRecord(saved.stopwatch)) return fallback;

  const phase = saved.pomodoro.phase;
  if (!phases.includes(/** @type {Phase} */ (phase))) return fallback;
  const typedPhase = /** @type {Phase} */ (phase);
  const remaining = saved.pomodoro.remaining;
  const deadline = saved.pomodoro.deadline;
  const completed = saved.pomodoro.completed;
  if (!Number.isFinite(remaining) || Number(remaining) < 0 || Number(remaining) > duration(settings, typedPhase)) return fallback;
  if (deadline !== null && (!Number.isFinite(deadline) || Number(deadline) < 0)) return fallback;
  if (deadline !== null && (Number(deadline) < savedAt - 5 * 60_000 || Number(deadline) > savedAt + duration(settings, typedPhase) + 5 * 60_000)) return fallback;
  if (!Number.isInteger(completed) || Number(completed) < 0) return fallback;

  const accumulated = saved.stopwatch.accumulated;
  const startedAt = saved.stopwatch.startedAt;
  const laps = saved.stopwatch.laps;
  if (!Number.isFinite(accumulated) || Number(accumulated) < 0) return fallback;
  if (startedAt !== null && (!Number.isFinite(startedAt) || Number(startedAt) < 0 || Number(startedAt) > now)) return fallback;
  if (startedAt !== null && Number(startedAt) < savedAt - RUNTIME_MAX_AGE) return fallback;
  if (!Array.isArray(laps) || laps.length > 100 || !laps.every((lap) => Number.isFinite(lap) && Number(lap) >= 0)) return fallback;

  const stopwatch = {
    accumulated: Number(accumulated),
    startedAt: startedAt === null ? null : Number(startedAt),
    laps: laps.map(Number)
  };
  const totalElapsed = elapsed(stopwatch, now);
  if (stopwatch.laps.some((lap, index) => lap > totalElapsed || (index > 0 && lap < stopwatch.laps[index - 1]))) return fallback;

  const restoredPomodoro = {
    phase: typedPhase,
    remaining: Number(remaining),
    deadline: deadline === null ? null : Number(deadline),
    completed: Number(completed),
    notice: ''
  };
  const advanced = advancePomodoro(restoredPomodoro, settings, now);
  return {
    runtime: { pomodoro: advanced.timer, stopwatch },
    restored: true,
    transitions: advanced.transitions
  };
}

/** @param {RuntimeState} runtime @param {number} [now] */
export function runtimeSnapshot(runtime, now = Date.now()) {
  return {
    version: RUNTIME_VERSION,
    savedAt: now,
    pomodoro: {
      phase: runtime.pomodoro.phase,
      remaining: runtime.pomodoro.remaining,
      deadline: runtime.pomodoro.deadline,
      completed: runtime.pomodoro.completed
    },
    stopwatch: {
      accumulated: runtime.stopwatch.accumulated,
      startedAt: runtime.stopwatch.startedAt,
      laps: [...runtime.stopwatch.laps]
    }
  };
}

/** @param {{ setItem: (key: string, value: string) => void }} storage @param {string} key @param {unknown} value */
export function saveJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const fallbackTimeZones = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

/** @param {string[]} supported @param {...string} preferred */
export function buildTimeZones(supported, ...preferred) {
  return [...new Set([...fallbackTimeZones, ...supported, ...preferred])]
    .filter(isValidTimeZone)
    .sort((left, right) => left.localeCompare(right));
}
