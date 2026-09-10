import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(root, 'public', 'sounds');
const sampleRate = 22_050;

function envelope(time, attack, decay) {
  return Math.min(1, time / attack) * Math.exp(-time * decay);
}

function softChime(time) {
  const notes = [523.25, 659.25, 783.99];
  return notes.reduce((value, frequency, index) => {
    const start = index * .16;
    const local = time - start;
    if (local < 0) return value;
    return value + Math.sin(2 * Math.PI * frequency * local) * envelope(local, .018, 3.7) / notes.length;
  }, 0);
}

function glassBell(time) {
  const fundamental = 587.33;
  const partials = [[1, .55], [2.01, .24], [2.96, .13], [4.18, .08]];
  return partials.reduce((value, [ratio, gain]) => (
    value + Math.sin(2 * Math.PI * fundamental * ratio * time) * gain * envelope(time, .008, 2.8 + ratio)
  ), 0);
}

function digitalPulse(time) {
  const pulse = Math.floor(time / .18);
  const local = time - pulse * .18;
  if (pulse > 1 || local > .1) return 0;
  const carrier = Math.sin(2 * Math.PI * (pulse ? 740 : 620) * local);
  return Math.tanh(carrier * 2.2) * envelope(local, .004, 13) * .42;
}

function createWav(duration, sample) {
  const sampleCount = Math.ceil(duration * sampleRate);
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.max(-1, Math.min(1, sample(index / sampleRate)));
    buffer.writeInt16LE(Math.round(value * 28_000), 44 + index * 2);
  }
  return buffer;
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'soft-chime.wav'), createWav(1.35, softChime)),
  writeFile(resolve(outputDirectory, 'glass-bell.wav'), createWav(1.5, glassBell)),
  writeFile(resolve(outputDirectory, 'digital-pulse.wav'), createWav(.38, digitalPulse))
]);

console.log('Generated Pomodoro alert sounds in public/sounds.');
