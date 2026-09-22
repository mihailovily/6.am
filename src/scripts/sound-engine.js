import { effectiveVolume, nextShuffleIndex } from './sound-domain.js';
import { publicSoundUrl } from './sound-catalog.js';

const fadeStepMs = 40;

/** @typedef {{id:string,name:string,file:string,mode?:'loop'|'intermittent'}} EngineAmbientSound */
/** @typedef {{id:string,name:string,file:string}} EngineLofiTrack */
/** @typedef {{type:string,id?:string,message?:string,active?:string[],paused?:boolean,lofiPlaying?:boolean,lofiPaused?:boolean,lofiIndex?:number}} EngineEvent */
/** @typedef {{player:HTMLAudioElement,volume:number,cancelFade:()=>void,sound:EngineAmbientSound}} AmbientEntry */

/** @param {HTMLAudioElement} player @param {number} target @param {number} seconds @param {()=>void} [onDone] */
function fade(player, target, seconds, onDone) {
  const start = player.volume;
  const duration = Math.max(0, seconds * 1_000);
  if (!duration) {
    player.volume = target;
    onDone?.();
    return () => {};
  }
  const started = performance.now();
  const timer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - started) / duration);
    player.volume = Math.min(1, Math.max(0, start + (target - start) * progress));
    if (progress === 1) {
      clearInterval(timer);
      onDone?.();
    }
  }, fadeStepMs);
  return () => clearInterval(timer);
}

/** @param {{ambient:EngineAmbientSound[],lofi:EngineLofiTrack[],onChange?:(event:EngineEvent)=>void}} options */
export function createSoundEngine({ ambient, lofi, onChange = () => {} }) {
  const players = /** @type {Map<string, AmbientEntry>} */ (new Map());
  const intermittentTimers = /** @type {Map<string, number>} */ (new Map());
  const lofiPlayers = [new Audio(), new Audio()];
  let master = 65;
  let fadeSeconds = 2;
  let paused = false;
  let lofiIndex = -1;
  let activeLofi = 0;
  let lofiVolume = 55;
  let lofiPlaying = false;
  let lofiPaused = false;
  let crossfading = false;

  lofiPlayers.forEach((player) => {
    player.preload = 'auto';
    player.addEventListener('timeupdate', () => {
      if (player !== lofiPlayers[activeLofi] || crossfading || !Number.isFinite(player.duration)) return;
      if (player.duration - player.currentTime < 2.2) void advanceLofi(true);
    });
    player.addEventListener('ended', () => { if (player === lofiPlayers[activeLofi]) void advanceLofi(false); });
    player.addEventListener('error', () => onChange({ type: 'error', message: 'A local radio track could not be loaded.' }));
  });

  function emit() {
    onChange({ type: 'state', active: [...players.keys()], paused, lofiPlaying, lofiPaused, lofiIndex });
  }

  /** @param {number} volume */
  function targetVolume(volume) {
    return effectiveVolume(volume, master);
  }

  /** @param {string} id */
  function clearIntermittent(id) {
    const timer = intermittentTimers.get(id);
    if (timer) clearTimeout(timer);
    intermittentTimers.delete(id);
  }

  /** @param {EngineAmbientSound} sound @param {HTMLAudioElement} player */
  function scheduleIntermittent(sound, player) {
    if (!players.has(sound.id) || paused) return;
    clearIntermittent(sound.id);
    const timer = window.setTimeout(() => {
      if (!players.has(sound.id) || paused) return;
      player.currentTime = 0;
      void player.play().catch(() => onChange({ type: 'error', id: sound.id, message: `${sound.name} could not resume.` }));
    }, 4_000 + Math.random() * 10_000);
    intermittentTimers.set(sound.id, timer);
  }

  /** @param {EngineAmbientSound} sound @param {number} [volume] */
  async function startAmbient(sound, volume = 65) {
    if (players.has(sound.id)) return true;
    const player = new Audio(publicSoundUrl('ambient', sound.file));
    player.preload = 'auto';
    player.loop = sound.mode !== 'intermittent';
    player.volume = 0;
    const entry = { player, volume, cancelFade: () => {}, sound };
    players.set(sound.id, entry);
    if (sound.mode === 'intermittent') player.addEventListener('ended', () => scheduleIntermittent(sound, player));
    onChange({ type: 'loading', id: sound.id });
    try {
      await player.play();
      entry.cancelFade = fade(player, targetVolume(volume), fadeSeconds);
      paused = false;
      emit();
      return true;
    } catch {
      players.delete(sound.id);
      onChange({ type: 'error', id: sound.id, message: `${sound.name} could not be played.` });
      emit();
      return false;
    }
  }

  /** @param {string} id @param {boolean} [immediate] */
  function stopAmbient(id, immediate = false) {
    const entry = players.get(id);
    if (!entry) return;
    clearIntermittent(id);
    entry.cancelFade();
    const finish = () => {
      entry.player.pause();
      entry.player.removeAttribute('src');
      entry.player.load();
      players.delete(id);
      emit();
    };
    if (immediate || paused) finish();
    else entry.cancelFade = fade(entry.player, 0, fadeSeconds, finish);
    onChange({ type: 'stopping', id });
  }

  /** @param {string} id @param {number} volume */
  function setAmbientVolume(id, volume) {
    const entry = players.get(id);
    if (!entry) return;
    entry.volume = volume;
    entry.player.volume = targetVolume(volume);
  }

  /** @param {number} value */
  function setMaster(value) {
    master = value;
    for (const entry of players.values()) entry.player.volume = targetVolume(entry.volume);
    lofiPlayers.forEach((player, index) => { if (index === activeLofi) player.volume = targetVolume(lofiVolume); });
  }

  /** @param {number} value */
  function setFade(value) { fadeSeconds = value; }

  /** @param {number} index @param {boolean} [crossfade] */
  async function playLofiAt(index, crossfade = false) {
    if (!lofi.length) return false;
    const nextPlayerIndex = crossfade ? 1 - activeLofi : activeLofi;
    const next = lofiPlayers[nextPlayerIndex];
    const previous = lofiPlayers[activeLofi];
    next.src = publicSoundUrl('lofi', lofi[index].file);
    next.currentTime = 0;
    next.volume = 0;
    try {
      await next.play();
      lofiIndex = index;
      lofiPlaying = true;
      lofiPaused = false;
      paused = false;
      if (crossfade && next !== previous) {
        crossfading = true;
        fade(next, targetVolume(lofiVolume), Math.min(2, fadeSeconds || 0.6));
        fade(previous, 0, Math.min(2, fadeSeconds || 0.6), () => {
          previous.pause();
          activeLofi = nextPlayerIndex;
          crossfading = false;
          emit();
        });
      } else {
        activeLofi = nextPlayerIndex;
        next.volume = targetVolume(lofiVolume);
      }
      emit();
      return true;
    } catch {
      lofiPlaying = false;
      onChange({ type: 'error', message: 'This local radio track could not be played. Try the next track.' });
      emit();
      return false;
    }
  }

  async function startLofi() {
    if (lofiPlaying && paused) return resumeAll();
    if (lofiPlaying && lofiPaused) return resumeLofi();
    return playLofiAt(nextShuffleIndex(lofi.length, lofiIndex));
  }

  async function advanceLofi(crossfade = true) {
    if (!lofiPlaying) return false;
    return playLofiAt(nextShuffleIndex(lofi.length, lofiIndex), crossfade);
  }

  function stopLofi() {
    lofiPlayers.forEach((player) => { player.pause(); player.removeAttribute('src'); player.load(); });
    lofiPlaying = false;
    lofiPaused = false;
    crossfading = false;
    emit();
  }

  function pauseLofi() {
    if (!lofiPlaying) return;
    lofiPlayers[activeLofi].pause();
    lofiPaused = true;
    emit();
  }

  async function resumeLofi() {
    if (!lofiPlaying || !lofiPlayers[activeLofi].src) return false;
    try {
      await lofiPlayers[activeLofi].play();
      lofiPaused = false;
      emit();
      return true;
    } catch {
      onChange({ type: 'error', message: 'The local radio could not resume.' });
      return false;
    }
  }

  function pauseAll() {
    paused = true;
    for (const [id, entry] of players) { clearIntermittent(id); entry.player.pause(); }
    lofiPlayers.forEach((player) => player.pause());
    emit();
  }

  async function resumeAll() {
    const attempts = [...players.values()].map(({ player, sound }) => player.play().catch(() => {
      onChange({ type: 'error', id: sound.id, message: `${sound.name} could not resume.` });
    }));
    if (lofiPlaying && lofiPlayers[activeLofi].src) attempts.push(lofiPlayers[activeLofi].play().catch(() => {}));
    await Promise.all(attempts);
    paused = false;
    lofiPaused = false;
    emit();
    return true;
  }

  function stopAll() {
    [...players.keys()].forEach((id) => stopAmbient(id, true));
    stopLofi();
    paused = false;
    emit();
  }

  /** @param {number} value */
  function setLofiVolume(value) {
    lofiVolume = value;
    lofiPlayers[activeLofi].volume = targetVolume(value);
  }

  return { startAmbient, stopAmbient, setAmbientVolume, setMaster, setFade, startLofi, advanceLofi, stopLofi, pauseLofi, resumeLofi, setLofiVolume, pauseAll, resumeAll, stopAll, snapshot: () => ({ active: [...players.keys()], paused, lofiPlaying, lofiPaused, lofiIndex }) };
}
