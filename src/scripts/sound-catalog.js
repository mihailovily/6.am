const moodist = 'https://github.com/remvze/moodist';
const cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** @typedef {{id:string,name:string,group:string,icon:string,file:string,sourcePath:string,tags:string[],mode?:'loop'|'intermittent',sourceUrl:string,license:string,licenseUrl:string}} AmbientSound */

/** @type {AmbientSound[]} */
export const ambientSounds = [
  { id: 'birds', name: 'Birds', group: 'Life', icon: '◌', file: 'birds.mp3', sourcePath: 'animals/birds.mp3', tags: ['forest', 'morning'], mode: 'intermittent' },
  { id: 'crickets', name: 'Crickets', group: 'Life', icon: '✳', file: 'crickets.mp3', sourcePath: 'animals/crickets.mp3', tags: ['insects', 'night'] },
  { id: 'heartbeat', name: 'Heartbeat', group: 'Life', icon: '♡', file: 'heartbeat.flac', sourcePath: '', tags: ['pulse', 'body'], sourceUrl: 'https://opengameart.org/content/heartbeat-single-sound', license: 'CC0 1.0', licenseUrl: cc0 },
  { id: 'purring-cat', name: 'Purring Cat', group: 'Life', icon: '≈', file: 'purring-cat.mp3', sourcePath: 'animals/cat-purring.mp3', tags: ['cat', 'pet'] },
  { id: 'quiet-conversations', name: 'Quiet Conversations', group: 'Life', icon: '“', file: 'quiet-conversations.mp3', sourcePath: 'places/crowded-bar.mp3', tags: ['people', 'voices', 'room'] },
  { id: 'seagulls', name: 'Seagulls', group: 'Life', icon: '⌁', file: 'seagulls.mp3', sourcePath: 'animals/seagulls.mp3', tags: ['birds', 'coast'], mode: 'intermittent' },
  { id: 'walking-in-snow', name: 'Walking in Snow', group: 'Life', icon: '∙', file: 'walking-in-snow.mp3', sourcePath: 'nature/walk-in-snow.mp3', tags: ['steps', 'winter'] },
  { id: 'wolves', name: 'Wolves', group: 'Life', icon: '△', file: 'wolves.mp3', sourcePath: 'animals/wolf.mp3', tags: ['howl', 'night'], mode: 'intermittent' },

  { id: 'campfire', name: 'Campfire', group: 'Places', icon: '∴', file: 'campfire.mp3', sourcePath: 'nature/campfire.mp3', tags: ['fire', 'crackle'] },
  { id: 'coffee-shop', name: 'Coffee Shop', group: 'Places', icon: '◡', file: 'coffee-shop.mp3', sourcePath: 'places/cafe.mp3', tags: ['cafe', 'people'] },
  { id: 'office', name: 'Office', group: 'Places', icon: '▦', file: 'office.mp3', sourcePath: 'places/office.mp3', tags: ['work', 'keyboard'] },
  { id: 'public-library', name: 'Public Library', group: 'Places', icon: '≡', file: 'public-library.mp3', sourcePath: 'places/library.mp3', tags: ['books', 'study'] },
  { id: 'scuba-diving', name: 'Scuba Diving', group: 'Places', icon: '◌', file: 'scuba-diving.mp3', sourcePath: 'places/underwater.mp3', tags: ['underwater', 'bubbles'] },
  { id: 'seashore', name: 'Seashore', group: 'Places', icon: '≋', file: 'seashore.mp3', sourcePath: 'nature/waves.mp3', tags: ['waves', 'ocean'] },
  { id: 'water-stream', name: 'Water Stream', group: 'Places', icon: '≈', file: 'water-stream.mp3', sourcePath: 'nature/river.mp3', tags: ['river', 'water'] },
  { id: 'palm-wind', name: 'Wind Through Palm Trees', group: 'Places', icon: '⑂', file: 'palm-wind.mp3', sourcePath: 'nature/wind-in-trees.mp3', tags: ['leaves', 'tropical', 'wind'] },

  { id: 'brown-noise', name: 'Brownian Noise', group: 'Raw Noise', icon: '≋', file: 'brown-noise.wav', sourcePath: 'noise/brown-noise.wav', tags: ['deep', 'masking'] },
  { id: 'pink-noise', name: 'Pink Noise', group: 'Raw Noise', icon: '≋', file: 'pink-noise.wav', sourcePath: 'noise/pink-noise.wav', tags: ['balanced', 'masking'] },
  { id: 'white-noise', name: 'White Noise', group: 'Raw Noise', icon: '≋', file: 'white-noise.wav', sourcePath: 'noise/white-noise.wav', tags: ['bright', 'masking'] },

  { id: 'fan', name: 'Fan', group: 'Things', icon: '✵', file: 'fan.mp3', sourcePath: 'things/ceiling-fan.mp3', tags: ['room', 'hum'] },
  { id: 'wall-clock', name: 'Wall Clock', group: 'Things', icon: '◷', file: 'wall-clock.mp3', sourcePath: 'things/clock.mp3', tags: ['tick', 'time'] },
  { id: 'wind-chimes', name: 'Wind Chimes', group: 'Things', icon: '✧', file: 'wind-chimes.mp3', sourcePath: 'things/wind-chimes.mp3', tags: ['bells', 'garden'], mode: 'intermittent' },

  { id: 'air-travel', name: 'Air Travel', group: 'Travel', icon: '↗', file: 'air-travel.mp3', sourcePath: 'transport/airplane.mp3', tags: ['plane', 'cabin'] },
  { id: 'creaking-boat', name: 'Creaking Boat', group: 'Travel', icon: '⌣', file: 'creaking-boat.mp3', sourcePath: 'transport/sailboat.mp3', tags: ['sea', 'wood'] },
  { id: 'electric-car', name: 'Electric Car', group: 'Travel', icon: '→', file: 'electric-car.mp3', sourcePath: 'urban/road.mp3', tags: ['road', 'drive'] },
  { id: 'train', name: 'Train', group: 'Travel', icon: '═', file: 'train.mp3', sourcePath: 'transport/inside-a-train.mp3', tags: ['rail', 'carriage'] },

  { id: 'morning-village', name: 'Morning in a Village', group: 'Weather', icon: '◌', file: 'morning-village.mp3', sourcePath: 'animals/chickens.mp3', tags: ['dawn', 'rural'] },
  { id: 'night', name: 'Night', group: 'Weather', icon: '◔', file: 'night.mp3', sourcePath: 'places/night-village.mp3', tags: ['dark', 'village'] },
  { id: 'rain', name: 'Rain', group: 'Weather', icon: '⋮', file: 'rain.mp3', sourcePath: 'rain/light-rain.mp3', tags: ['water', 'storm'] },
  { id: 'soft-wind', name: 'Soft Wind', group: 'Weather', icon: '∿', file: 'soft-wind.mp3', sourcePath: 'nature/wind.mp3', tags: ['air', 'breeze'] },
  { id: 'thunder', name: 'Thunder', group: 'Weather', icon: '↯', file: 'thunder.mp3', sourcePath: 'rain/thunder.mp3', tags: ['storm', 'rumble'], mode: 'intermittent' }
].map((sound) => /** @type {AmbientSound} */ ({
  mode: 'loop', sourceUrl: moodist, license: 'CC0 or Pixabay Content License',
  licenseUrl: 'https://github.com/remvze/moodist#third-party-assets', ...sound
}));

const lofiNames = [
  ['dusk-between-stoops', 'Dusk Between Stoops'],
  ['dust-on-the-morning-keys', 'Dust on the Morning Keys'],
  ['glow-on-the-overpass', 'Glow on the Overpass'],
  ['porchlight-golden-hour', 'Porchlight Golden Hour'],
  ['sidewalk-slow-jam', 'Sidewalk Slow Jam'],
  ['soft-gold-sky', 'Soft Gold Sky'],
  ['sunset-offbeat', 'Sunset Offbeat'],
  ['window-seat-daydream', 'Window Seat Daydream']
];

export const lofiTracks = lofiNames.map(([id, name]) => ({
  id, name, artist: 'Open Lo-Fi', file: `${id}.mp3`, license: 'CC0 1.0',
  sourceUrl: 'https://github.com/btahir/open-lofi', licenseUrl: cc0
}));

export const soundGroups = ['Life', 'Places', 'Raw Noise', 'Things', 'Travel', 'Weather'];
/** @param {string} folder @param {string} file */
export function publicSoundUrl(folder, file) {
  return new URL(`sounds/${folder}/${file}`, new URL(import.meta.env.BASE_URL, location.origin)).href;
}
