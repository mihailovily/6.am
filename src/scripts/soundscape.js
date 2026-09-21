import { ambientSounds, liveRadio, lofiTracks, soundGroups } from './sound-catalog.js';
import { createSoundEngine } from './sound-engine.js';
import { defaultSoundscape, normalizeSoundscape, searchSounds, soundscapeStorageKey } from './sound-domain.js';

/** @typedef {{version:1,master:number,fadeSeconds:number,selected:Record<string, number>,lofiMode:'local'|'live',lofiVolume:number,lofiEnabled:boolean}} SoundscapeConfig */
/** @typedef {{id:string,name:string,group:string,icon:string,file:string,tags:string[],mode?:'loop'|'intermittent',sourceUrl:string,license:string}} CatalogSound */
/** @typedef {{type:string,id?:string,message?:string,active?:string[],paused?:boolean,lofiPlaying?:boolean,lofiIndex?:number}} EngineEvent */

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));
const byId = new Map(ambientSounds.map((sound) => [sound.id, sound]));
let config = /** @type {SoundscapeConfig} */ (readConfig());
let configuredButStopped = Object.keys(config.selected).length > 0 || config.lofiEnabled;
let cardStates = new Map();

function readConfig() {
  try { return normalizeSoundscape(JSON.parse(localStorage.getItem(soundscapeStorageKey) || 'null'), ambientSounds.map(({ id }) => id)); }
  catch { return defaultSoundscape(); }
}

function saveConfig() {
  try { localStorage.setItem(soundscapeStorageKey, JSON.stringify(config)); } catch {}
}

/** @param {string} value */
function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

/** @param {CatalogSound} sound */
function soundCard(sound) {
  const selected = Object.hasOwn(config.selected, sound.id);
  const volume = selected ? config.selected[sound.id] : 65;
  return `<article class="sound-card${selected ? ' is-selected' : ''}" data-sound-id="${sound.id}" data-state="idle">
    <button class="sound-card-toggle" type="button" aria-pressed="false" aria-label="${selected ? 'Play' : 'Add'} ${escapeHtml(sound.name)}">
      <span class="sound-card-icon" aria-hidden="true">${sound.icon}</span>
      <span><strong>${escapeHtml(sound.name)}</strong><small>${sound.mode === 'intermittent' ? 'Natural intervals' : 'Seamless loop'}</small></span>
      <span class="sound-state" aria-hidden="true">▶</span>
    </button>
    <div class="sound-card-controls">
      <label><span class="visually-hidden">${escapeHtml(sound.name)} volume</span><input type="range" min="0" max="100" step="1" value="${volume}" data-track-volume></label>
      <button class="sound-info-button" type="button" data-sound-info aria-label="About ${escapeHtml(sound.name)}">i</button>
    </div>
  </article>`;
}

/** @param {string} [query] */
function renderCatalog(query = '') {
  const matches = searchSounds(ambientSounds, query);
  $('#sound-empty').hidden = matches.length > 0;
  $('#sound-grid').innerHTML = soundGroups.map((group) => {
    const sounds = matches.filter((sound) => sound.group === group);
    if (!sounds.length) return '';
    return `<section class="sound-group" aria-labelledby="sound-group-${group.replaceAll(' ', '-').toLowerCase()}">
      <div class="sound-group-heading"><h2 id="sound-group-${group.replaceAll(' ', '-').toLowerCase()}">${group}</h2><span>${String(sounds.length).padStart(2, '0')}</span></div>
      <div class="sound-card-grid">${sounds.map(soundCard).join('')}</div>
    </section>`;
  }).join('');
  syncCards();
}

/** @param {string} message @param {boolean} [error] */
function setStatus(message, error = false) {
  $('#sound-status').textContent = message;
  $('#sound-status').classList.toggle('error', error);
}

/** @param {EngineEvent} event */
function onEngineChange(event) {
  if (event.id && ['loading', 'stopping', 'error'].includes(event.type)) cardStates.set(event.id, event.type);
  if (event.type === 'state') {
    const active = new Set(event.active);
    ambientSounds.forEach(({ id }) => cardStates.set(id, active.has(id) ? (event.paused ? 'paused' : 'playing') : 'idle'));
    configuredButStopped = !active.size && !event.lofiPlaying && (Object.keys(config.selected).length > 0 || config.lofiEnabled);
    document.dispatchEvent(new CustomEvent('soundscapechange', { detail: { running: active.size > 0 || event.lofiPlaying, paused: event.paused } }));
  }
  if (event.type === 'error') setStatus(event.message || 'Sound playback failed.', true);
  syncCards();
  renderDock();
  renderLofi();
}

const engine = createSoundEngine({ ambient: ambientSounds, lofi: lofiTracks, onChange: onEngineChange });
engine.setMaster(config.master);
engine.setFade(config.fadeSeconds);
engine.setLofiVolume(config.lofiVolume);

function syncCards() {
  document.querySelectorAll('[data-sound-id]').forEach((element) => {
    const card = /** @type {HTMLElement} */ (element);
    const id = card.dataset.soundId;
    if (!id) return;
    const state = cardStates.get(id) || 'idle';
    const selected = Object.hasOwn(config.selected, id);
    card.dataset.state = state;
    card.classList.toggle('is-selected', selected);
    card.classList.toggle('is-active', state === 'playing' || state === 'loading');
    const button = /** @type {HTMLButtonElement} */ (card.querySelector('.sound-card-toggle'));
    button.setAttribute('aria-pressed', String(state === 'playing'));
    button.disabled = state === 'loading' || state === 'stopping';
    const label = state === 'playing' ? 'Stop' : state === 'loading' ? 'Loading' : 'Play';
    button.setAttribute('aria-label', `${label} ${byId.get(id)?.name || id}`);
    const marker = card.querySelector('.sound-state');
    if (marker) marker.textContent = state === 'loading' ? '…' : state === 'playing' ? '■' : state === 'stopping' ? '·' : '▶';
  });
}

function renderDock() {
  const snapshot = engine.snapshot();
  const count = Object.keys(config.selected).length + (config.lofiEnabled ? 1 : 0);
  $('#sound-dock').hidden = count === 0;
  $('#sound-dock-summary').textContent = count ? `${count} layer${count === 1 ? '' : 's'} in your mix` : 'No sounds selected';
  const toggle = /** @type {HTMLButtonElement} */ ($('#sound-dock-toggle'));
  toggle.textContent = snapshot.paused || configuredButStopped ? '▶' : 'Ⅱ';
  toggle.setAttribute('aria-label', snapshot.paused || configuredButStopped ? 'Resume soundscape' : 'Pause soundscape');
  /** @type {HTMLInputElement} */ ($('#dock-master-volume')).value = String(config.master);
  $('#dock-master-value').textContent = `${config.master}%`;
}

function renderLofi() {
  const snapshot = engine.snapshot();
  const track = snapshot.lofiIndex >= 0 ? lofiTracks[snapshot.lofiIndex] : null;
  $('#lofi-now').textContent = config.lofiMode === 'live' ? liveRadio.name : track?.name || 'Chillhop & Cozy Beats';
  $('#lofi-source').textContent = config.lofiMode === 'live' ? 'YouTube live stream' : `${lofiTracks.length} CC0 tracks · endless shuffle`;
  const play = /** @type {HTMLButtonElement} */ ($('#lofi-play'));
  play.textContent = snapshot.lofiPlaying ? 'Pause radio' : config.lofiEnabled ? 'Resume radio' : 'Play radio';
  $('#youtube-live-wrap').hidden = config.lofiMode !== 'live';
}

async function resumeConfiguredMix() {
  configuredButStopped = false;
  const tasks = Object.entries(config.selected).map(([id, volume]) => {
    const sound = byId.get(id);
    return sound ? engine.startAmbient(sound, volume) : Promise.resolve(false);
  });
  if (config.lofiEnabled) tasks.push(config.lofiMode === 'live'
    ? engine.startLive('youtube-player', liveRadio.videoId)
    : engine.startLofi());
  await Promise.all(tasks);
}

/** @param {string} id */
async function toggleSound(id) {
  const sound = byId.get(id);
  if (!sound) return;
  const state = cardStates.get(id);
  if (state === 'playing' || state === 'loading' || state === 'paused') {
    engine.stopAmbient(id);
    delete config.selected[id];
  } else {
    const input = /** @type {HTMLInputElement | null} */ (document.querySelector(`[data-sound-id="${id}"] [data-track-volume]`));
    const volume = Number(input?.value || config.selected[id] || 65);
    config.selected[id] = volume;
    const played = await engine.startAmbient(sound, volume);
    if (!played) delete config.selected[id];
  }
  configuredButStopped = false;
  saveConfig();
  renderDock();
  syncCards();
}

$('#sound-grid').addEventListener('click', (event) => {
  const target = /** @type {HTMLElement} */ (event.target);
  const card = /** @type {HTMLElement | null} */ (target.closest('[data-sound-id]'));
  if (!card?.dataset.soundId) return;
  if (target.closest('[data-sound-info]')) {
    const sound = byId.get(card.dataset.soundId);
    if (!sound) return;
    $('#sound-info-title').textContent = sound.name;
    $('#sound-info-copy').textContent = `${sound.group} · ${sound.mode === 'intermittent' ? 'plays at natural intervals' : 'loops continuously'}.`;
    const link = /** @type {HTMLAnchorElement} */ ($('#sound-info-source'));
    link.href = sound.sourceUrl;
    link.textContent = `${sound.license} · source`;
    /** @type {HTMLDialogElement} */ ($('#sound-info-dialog')).showModal();
    return;
  }
  if (target.closest('.sound-card-toggle')) void toggleSound(card.dataset.soundId);
});

$('#sound-grid').addEventListener('input', (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  if (!input.matches('[data-track-volume]')) return;
  const id = /** @type {HTMLElement | null} */ (input.closest('[data-sound-id]'))?.dataset.soundId;
  if (!id) return;
  const volume = Number(input.value);
  if (Object.hasOwn(config.selected, id)) config.selected[id] = volume;
  engine.setAmbientVolume(id, volume);
  saveConfig();
});

$('#sound-search').addEventListener('input', (event) => renderCatalog(/** @type {HTMLInputElement} */ (event.target).value));
$('#sound-info-close').addEventListener('click', () => /** @type {HTMLDialogElement} */ ($('#sound-info-dialog')).close());

$('#master-volume').addEventListener('input', (event) => {
  config.master = Number(/** @type {HTMLInputElement} */ (event.target).value);
  $('#master-volume-value').textContent = `${config.master}%`;
  engine.setMaster(config.master);
  saveConfig();
  renderDock();
});

$('#dock-master-volume').addEventListener('input', (event) => {
  config.master = Number(/** @type {HTMLInputElement} */ (event.target).value);
  /** @type {HTMLInputElement} */ ($('#master-volume')).value = String(config.master);
  $('#master-volume-value').textContent = `${config.master}%`;
  engine.setMaster(config.master);
  saveConfig();
  renderDock();
});

$('#fade-seconds').addEventListener('input', (event) => {
  config.fadeSeconds = Number(/** @type {HTMLInputElement} */ (event.target).value);
  $('#fade-value').textContent = `${config.fadeSeconds}s`;
  engine.setFade(config.fadeSeconds);
  saveConfig();
});

document.querySelectorAll('[name="lofi-mode"]').forEach((element) => element.addEventListener('change', () => {
  config.lofiMode = /** @type {HTMLInputElement} */ (element).value === 'live' ? 'live' : 'local';
  engine.stopLofi();
  config.lofiEnabled = false;
  saveConfig();
  renderLofi();
  renderDock();
}));

$('#lofi-play').addEventListener('click', async () => {
  const snapshot = engine.snapshot();
  if (snapshot.lofiPlaying) {
    engine.stopLofi();
    config.lofiEnabled = false;
  } else {
    config.lofiEnabled = true;
    const played = config.lofiMode === 'live'
      ? await engine.startLive('youtube-player', liveRadio.videoId)
      : await engine.startLofi();
    if (!played) config.lofiEnabled = false;
  }
  configuredButStopped = false;
  saveConfig();
  renderLofi();
  renderDock();
});

$('#lofi-next').addEventListener('click', () => { if (config.lofiMode === 'local') void engine.advanceLofi(false); });
$('#lofi-volume').addEventListener('input', (event) => {
  config.lofiVolume = Number(/** @type {HTMLInputElement} */ (event.target).value);
  $('#lofi-volume-value').textContent = `${config.lofiVolume}%`;
  engine.setLofiVolume(config.lofiVolume);
  saveConfig();
});
$('#lofi-fallback').addEventListener('click', () => {
  const radio = /** @type {HTMLInputElement} */ (document.querySelector('[name="lofi-mode"][value="local"]'));
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
  void /** @type {HTMLButtonElement} */ ($('#lofi-play')).click();
});

$('#sound-dock-toggle').addEventListener('click', () => {
  const snapshot = engine.snapshot();
  if (snapshot.paused) void engine.resumeAll();
  else if (configuredButStopped) void resumeConfiguredMix();
  else engine.pauseAll();
});

$('#sound-dock-stop').addEventListener('click', () => {
  engine.stopAll();
  config.selected = {};
  config.lofiEnabled = false;
  configuredButStopped = false;
  saveConfig();
  renderCatalog(/** @type {HTMLInputElement} */ ($('#sound-search')).value);
  renderDock();
});

export function pauseLiveForFullscreen() { if (config.lofiMode === 'live') engine.pauseLiveForFullscreen(); }

/** @type {HTMLInputElement} */ ($('#master-volume')).value = String(config.master);
/** @type {HTMLInputElement} */ ($('#dock-master-volume')).value = String(config.master);
/** @type {HTMLInputElement} */ ($('#fade-seconds')).value = String(config.fadeSeconds);
/** @type {HTMLInputElement} */ ($('#lofi-volume')).value = String(config.lofiVolume);
/** @type {HTMLInputElement} */ (document.querySelector(`[name="lofi-mode"][value="${config.lofiMode}"]`)).checked = true;
$('#master-volume-value').textContent = `${config.master}%`;
$('#fade-value').textContent = `${config.fadeSeconds}s`;
$('#lofi-volume-value').textContent = `${config.lofiVolume}%`;
renderCatalog();
renderDock();
renderLofi();
if (configuredButStopped) setStatus('Your saved mix is ready. Press Resume in the player when you want to hear it.');
