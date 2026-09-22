export const soundscapeStorageKey = '6am-soundscape';

/** @typedef {{version:2,master:number,fadeSeconds:number,selected:Record<string, number>,lofiVolume:number,lofiEnabled:boolean}} SoundscapeConfig */
/** @typedef {{name:string,group:string,tags?:string[]}} SearchableSound */

/** @param {unknown} value @param {number} [min] @param {number} [max] */
export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
}

/** @returns {SoundscapeConfig} */
export function defaultSoundscape() {
  return { version: 2, master: 65, fadeSeconds: 2, selected: {}, lofiVolume: 55, lofiEnabled: false };
}

/** @param {any} value @param {string[]} [validIds] @returns {SoundscapeConfig} */
export function normalizeSoundscape(value, validIds = []) {
  const defaults = defaultSoundscape();
  if (!value || typeof value !== 'object') return defaults;
  const valid = new Set(validIds);
  const selected = /** @type {Record<string, number>} */ ({});
  if (value.selected && typeof value.selected === 'object') {
    for (const [id, volume] of Object.entries(value.selected)) {
      if (valid.has(id)) selected[id] = Math.round(clamp(volume));
    }
  }
  return {
    version: 2,
    master: Math.round(clamp(value.master, 0, 100)),
    fadeSeconds: clamp(value.fadeSeconds, 0, 30),
    selected,
    lofiVolume: Math.round(clamp(value.lofiVolume, 0, 100)),
    lofiEnabled: value.lofiEnabled === true
  };
}

/** @template {SearchableSound} T @param {T[]} sounds @param {unknown} query @returns {T[]} */
export function searchSounds(sounds, query) {
  const term = String(query || '').trim().toLocaleLowerCase();
  if (!term) return sounds;
  return sounds.filter((sound) => [sound.name, sound.group, ...(sound.tags || [])].join(' ').toLocaleLowerCase().includes(term));
}

/** @param {unknown} trackVolume @param {unknown} masterVolume */
export function effectiveVolume(trackVolume, masterVolume) {
  return clamp(trackVolume) / 100 * (clamp(masterVolume) / 100);
}

/** @param {number} length @param {number} current @param {number} [randomValue] */
export function nextShuffleIndex(length, current, randomValue = Math.random()) {
  if (length <= 1) return 0;
  const offset = 1 + Math.floor(clamp(randomValue, 0, 0.999999) * (length - 1));
  return (Math.max(0, current) + offset) % length;
}
