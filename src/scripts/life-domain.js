const DAY_MS = 86_400_000;

/** @typedef {{iso: string, year: number, month: number, day: number, dayNumber: number}} DateParts */
/** @typedef {{total: number, past: number, current: number, remaining: number, percent: number}} Progress */
/** @typedef {{calendar: 'life', width: number, height: number, timeZone: string, today: DateParts, birthday: DateParts, progress: Progress}} LifeConfig */
/** @typedef {{calendar: 'goal', width: number, height: number, timeZone: string, today: DateParts, title: string, start: DateParts, deadline: DateParts, progress: Progress}} GoalConfig */
/** @typedef {{calendar: 'days'|'months'|'quarters', width: number, height: number, timeZone: string, today: DateParts, progress: Progress & {year: number}}} YearConfig */
/** @typedef {LifeConfig | GoalConfig | YearConfig} WallpaperConfig */
/** @typedef {{ok: true, value: WallpaperConfig} | {ok: false, status: number, error: string}} WallpaperParseResult */

export const LIFE_WEEKS = 90 * 52;
export const MAX_GOAL_DAYS = 3660;
export const CALENDARS = new Set(['life', 'days', 'months', 'quarters', 'goal']);

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** @param {string} value */
export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { iso: value, year, month, day, dayNumber: Math.floor(date.getTime() / DAY_MS) };
}

/** @param {Date} now @param {string} timeZone */
export function localDate(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return parseIsoDate(`${values.year}-${values.month}-${values.day}`);
  } catch {
    return null;
  }
}

/** @param {number} year */
export function daysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

/** @param {ReturnType<typeof parseIsoDate>} today @param {ReturnType<typeof parseIsoDate>} birthday */
export function lifeProgress(today, birthday) {
  if (!today || !birthday) throw new Error('A valid birthday is required.');
  const ageDays = today.dayNumber - birthday.dayNumber;
  if (ageDays < 0) throw new Error('Birthday cannot be in the future.');
  const week = Math.floor(ageDays / 7);
  const past = clamp(week, 0, LIFE_WEEKS);
  return {
    total: LIFE_WEEKS,
    past,
    current: week < LIFE_WEEKS ? week : -1,
    remaining: LIFE_WEEKS - past,
    percent: clamp((past / LIFE_WEEKS) * 100, 0, 100)
  };
}

/** @param {ReturnType<typeof parseIsoDate>} today */
export function yearProgress(today) {
  if (!today) throw new Error('A valid date is required.');
  const firstDay = Math.floor(Date.UTC(today.year, 0, 1) / DAY_MS);
  const total = daysInYear(today.year);
  const current = today.dayNumber - firstDay;
  return {
    total,
    past: current,
    current,
    remaining: total - current - 1,
    percent: (current / total) * 100,
    year: today.year
  };
}

/** @param {ReturnType<typeof parseIsoDate>} today @param {ReturnType<typeof parseIsoDate>} start @param {ReturnType<typeof parseIsoDate>} deadline */
export function goalProgress(today, start, deadline) {
  if (!today || !start || !deadline) throw new Error('Valid start and deadline dates are required.');
  if (start.dayNumber > deadline.dayNumber) throw new Error('Start date must be on or before the deadline.');
  const total = deadline.dayNumber - start.dayNumber + 1;
  if (total > MAX_GOAL_DAYS) throw new Error('Goal range cannot exceed 3660 days.');
  const offset = today.dayNumber - start.dayNumber;
  const inside = offset >= 0 && offset < total;
  const past = offset < 0 ? 0 : offset >= total ? total : offset;
  return {
    total,
    past,
    current: inside ? offset : -1,
    remaining: offset < 0 ? total : Math.max(0, deadline.dayNumber - today.dayNumber),
    percent: clamp((past / total) * 100, 0, 100)
  };
}

/** @param {string} value */
export function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character] || character);
}

/** @param {URL | string} input @param {Date} [now] @returns {WallpaperParseResult} */
export function parseWallpaperRequest(input, now = new Date()) {
  const url = input instanceof URL ? input : new URL(input, 'https://6.am');
  const calendar = url.searchParams.get('calendar') || '';
  if (!CALENDARS.has(calendar)) return { ok: false, status: 404, error: 'Unknown calendar.' };

  const width = Number(url.searchParams.get('width'));
  const height = Number(url.searchParams.get('height'));
  if (!Number.isInteger(width) || width < 320 || width > 2160) return { ok: false, status: 400, error: 'Width must be an integer from 320 to 2160.' };
  if (!Number.isInteger(height) || height < 568 || height > 4320 || height < width) return { ok: false, status: 400, error: 'Height must be an integer from 568 to 4320 and not smaller than width.' };

  const timeZone = url.searchParams.get('tz') || 'UTC';
  const today = localDate(now, timeZone);
  if (!today) return { ok: false, status: 400, error: 'Use a valid IANA time zone.' };

  const base = { calendar, width, height, timeZone, today };
  if (calendar === 'life') {
    const birthday = parseIsoDate(url.searchParams.get('birthday') || '');
    if (!birthday) return { ok: false, status: 400, error: 'Use a valid birthday in YYYY-MM-DD format.' };
    try {
      return { ok: true, value: /** @type {LifeConfig} */ ({ ...base, calendar: 'life', birthday, progress: lifeProgress(today, birthday) }) };
    } catch (error) {
      return { ok: false, status: 400, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (calendar === 'goal') {
    const title = (url.searchParams.get('title') || '').trim();
    if (!title) return { ok: false, status: 400, error: 'Goal title is required.' };
    if ([...title].length > 80) return { ok: false, status: 400, error: 'Goal title cannot exceed 80 characters.' };
    const start = parseIsoDate(url.searchParams.get('start') || '');
    const deadline = parseIsoDate(url.searchParams.get('deadline') || '');
    if (!start || !deadline) return { ok: false, status: 400, error: 'Use valid start and deadline dates in YYYY-MM-DD format.' };
    try {
      return { ok: true, value: /** @type {GoalConfig} */ ({ ...base, calendar: 'goal', title, start, deadline, progress: goalProgress(today, start, deadline) }) };
    } catch (error) {
      return { ok: false, status: 400, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { ok: true, value: /** @type {YearConfig} */ ({ ...base, calendar, progress: yearProgress(today) }) };
}

/** @param {number} value */
function percentLabel(value) {
  return `${Math.round(value * 10) / 10}%`;
}

/** @param {number} count @param {number} columns @param {number} startX @param {number} startY @param {number} gap @param {number} radius @param {{past: number, current: number}} progress */
function dots(count, columns, startX, startY, gap, radius, progress) {
  let output = '';
  for (let index = 0; index < count; index += 1) {
    const fill = index < progress.past ? '#f0f1f3' : index === progress.current ? '#a7bfce' : '#353e47';
    output += `<circle cx="${(startX + (index % columns) * gap).toFixed(2)}" cy="${(startY + Math.floor(index / columns) * gap).toFixed(2)}" r="${radius.toFixed(2)}" fill="${fill}"/>`;
  }
  return output;
}

/** @param {WallpaperConfig} config */
export function buildWallpaperSvg(config) {
  const { width, height, calendar, progress } = config;
  const pad = width * 0.075;
  const usableWidth = width - pad * 2;
  const contentTop = height * 0.39;
  const contentBottom = height * 0.84;
  const labelY = height * 0.91;
  let graphic = '';
  let heading = '';
  let summary = '';

  if (calendar === 'life') {
    const gap = Math.min(usableWidth / 51, (contentBottom - contentTop) / 89);
    const gridWidth = gap * 51;
    graphic = dots(LIFE_WEEKS, 52, (width - gridWidth) / 2, contentTop, gap, Math.max(0.8, gap * 0.22), progress);
    heading = '90 YEARS IN WEEKS';
    summary = `${percentLabel(progress.percent)} lived · ${progress.remaining.toLocaleString('en-US')} weeks remain`;
  } else if (calendar === 'days') {
    const columns = 20;
    const rows = Math.ceil(progress.total / columns);
    const gap = Math.min(usableWidth / (columns - 1), (contentBottom - contentTop) / (rows - 1));
    const gridWidth = gap * (columns - 1);
    graphic = dots(progress.total, columns, (width - gridWidth) / 2, contentTop, gap, Math.max(1.5, gap * 0.21), progress);
    heading = `${progress.year} / DAYS`;
    summary = `${progress.remaining} days remain · ${percentLabel(progress.percent)}`;
  } else if (calendar === 'months') {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const blockWidth = usableWidth / 3;
    const blockHeight = (contentBottom - contentTop) / 4;
    let dayOffset = 0;
    for (let month = 0; month < 12; month += 1) {
      const days = new Date(Date.UTC(progress.year, month + 1, 0)).getUTCDate();
      const col = month % 3;
      const row = Math.floor(month / 3);
      const x = pad + col * blockWidth;
      const y = contentTop + row * blockHeight;
      const gap = Math.min(blockWidth * 0.11, blockHeight * 0.16);
      const localProgress = { past: clamp(progress.past - dayOffset, 0, days), current: progress.current - dayOffset };
      graphic += `<text x="${x}" y="${y}" fill="#a0a5ad" font-size="${width * 0.017}" letter-spacing="${width * 0.002}">${monthNames[month]}</text>`;
      graphic += dots(days, 7, x, y + gap, gap, Math.max(1, gap * 0.2), localProgress);
      dayOffset += days;
    }
    heading = `${progress.year} / MONTHS`;
    summary = `${progress.remaining} days remain · ${percentLabel(progress.percent)}`;
  } else if (calendar === 'quarters') {
    const blockWidth = usableWidth / 2;
    const blockHeight = (contentBottom - contentTop) / 2;
    let dayOffset = 0;
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const startMonth = quarter * 3;
      const quarterDays = [0, 1, 2].reduce((total, offset) => total + new Date(Date.UTC(progress.year, startMonth + offset + 1, 0)).getUTCDate(), 0);
      const col = quarter % 2;
      const row = Math.floor(quarter / 2);
      const x = pad + col * blockWidth;
      const y = contentTop + row * blockHeight;
      const gap = Math.min(blockWidth * 0.07, blockHeight * 0.1);
      const localProgress = { past: clamp(progress.past - dayOffset, 0, quarterDays), current: progress.current - dayOffset };
      graphic += `<text x="${x}" y="${y}" fill="#a0a5ad" font-size="${width * 0.019}" letter-spacing="${width * 0.002}">Q${quarter + 1}</text>`;
      graphic += dots(quarterDays, 13, x, y + gap * 1.2, gap, Math.max(1, gap * 0.2), localProgress);
      dayOffset += quarterDays;
    }
    heading = `${progress.year} / QUARTERS`;
    summary = `${progress.remaining} days remain · ${percentLabel(progress.percent)}`;
  } else if (calendar === 'goal') {
    const columns = progress.total <= 31 ? 7 : progress.total <= 180 ? 14 : progress.total <= 730 ? 20 : 30;
    const rows = Math.ceil(progress.total / columns);
    const gap = Math.min(usableWidth / Math.max(1, columns - 1), (contentBottom - contentTop) / Math.max(1, rows - 1));
    const gridWidth = gap * Math.min(columns - 1, progress.total - 1);
    graphic = dots(progress.total, columns, (width - gridWidth) / 2, contentTop, gap, Math.max(0.8, gap * 0.21), progress);
    heading = escapeXml(config.title);
    summary = `${progress.remaining} days remain · ${percentLabel(progress.percent)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#08090b"/>
  <text x="${width / 2}" y="${contentTop - height * 0.045}" text-anchor="middle" fill="#f0f1f3" font-family="Geist, sans-serif" font-size="${Math.max(18, width * 0.035)}" font-weight="520" letter-spacing="${width * 0.0015}">${heading}</text>
  ${graphic}
  <text x="${width / 2}" y="${labelY}" text-anchor="middle" fill="#a0a5ad" font-family="Geist, sans-serif" font-size="${Math.max(13, width * 0.022)}">${summary}</text>
  <text x="${width / 2}" y="${height * 0.957}" text-anchor="middle" fill="#59616a" font-family="Geist, sans-serif" font-size="${Math.max(10, width * 0.015)}" letter-spacing="${width * 0.003}">6.AM / LIFE</text>
</svg>`;
}

/** @param {WallpaperConfig} config */
export function canonicalWallpaperParams(config) {
  const params = new URLSearchParams({
    calendar: config.calendar,
    width: String(config.width),
    height: String(config.height),
    tz: config.timeZone
  });
  if (config.calendar === 'life') params.set('birthday', config.birthday.iso);
  if (config.calendar === 'goal') {
    params.set('title', config.title);
    params.set('start', config.start.iso);
    params.set('deadline', config.deadline.iso);
  }
  params.sort();
  return params;
}

/** @param {WallpaperConfig} config */
export function wallpaperCacheKey(config) {
  const params = canonicalWallpaperParams(config);
  params.set('_date', config.today.iso);
  return params.toString();
}
