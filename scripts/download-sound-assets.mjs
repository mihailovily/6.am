import { mkdir, stat, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { ambientSounds, lofiTracks } from '../src/scripts/sound-catalog.js';

const root = new URL('../public/sounds/', import.meta.url);
const ambientDirectory = new URL('ambient/', root);
const lofiDirectory = new URL('lofi/', root);
const headers = { 'User-Agent': '6.am asset fetcher' };

await mkdir(ambientDirectory, { recursive: true });
await mkdir(lofiDirectory, { recursive: true });

async function download(url, destination) {
  try { if ((await stat(destination)).size > 0) return; } catch {}
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, body);
  console.log(`saved ${destination.pathname.split('/').at(-1)} (${Math.round(body.length / 1024)} KiB)`);
}

for (const sound of ambientSounds) {
  const source = sound.id === 'heartbeat'
    ? 'https://opengameart.org/sites/default/files/heartbeat.mp3_.flac'
    : `https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/${sound.sourcePath}`;
  await download(source, new URL(sound.file, ambientDirectory));
}

const releaseUrl = 'https://github.com/btahir/open-lofi/releases/download/v1.0.0/openlofi.zip';
const redirect = await fetch(releaseUrl, { headers, redirect: 'manual' });
const assetUrl = redirect.headers.get('location');
if (!assetUrl) throw new Error('Open Lo-Fi release redirect was not returned.');
const head = await fetch(assetUrl, { headers, method: 'HEAD' });
const zipSize = Number(head.headers.get('content-length'));

async function range(start, end) {
  const response = await fetch(assetUrl, { headers: { ...headers, Range: `bytes=${start}-${end}` } });
  if (response.status !== 206) throw new Error(`Release range failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const tailStart = Math.max(0, zipSize - 65_557);
const tail = await range(tailStart, zipSize - 1);
const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('Open Lo-Fi ZIP directory was not found.');
const centralSize = tail.readUInt32LE(eocd + 12);
const centralOffset = tail.readUInt32LE(eocd + 16);
const central = await range(centralOffset, centralOffset + centralSize - 1);
const entries = [];
for (let offset = 0; offset + 46 <= central.length;) {
  if (central.readUInt32LE(offset) !== 0x02014b50) break;
  const nameLength = central.readUInt16LE(offset + 28);
  const extraLength = central.readUInt16LE(offset + 30);
  const commentLength = central.readUInt16LE(offset + 32);
  entries.push({
    name: central.subarray(offset + 46, offset + 46 + nameLength).toString(),
    method: central.readUInt16LE(offset + 10),
    compressedSize: central.readUInt32LE(offset + 20),
    localOffset: central.readUInt32LE(offset + 42)
  });
  offset += 46 + nameLength + extraLength + commentLength;
}

for (const track of lofiTracks) {
  const destination = new URL(track.file, lofiDirectory);
  try { if ((await stat(destination)).size > 0) continue; } catch {}
  const entry = entries.find(({ name }) => name.toLowerCase().endsWith(`/${track.file}`) || name.toLowerCase() === track.file);
  if (!entry) throw new Error(`Missing ${track.file} in Open Lo-Fi release.`);
  const localHeader = await range(entry.localOffset, entry.localOffset + 29);
  const nameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = await range(dataOffset, dataOffset + entry.compressedSize - 1);
  const body = entry.method === 8 ? inflateRawSync(compressed) : compressed;
  await writeFile(destination, body);
  console.log(`saved ${track.file} (${Math.round(body.length / 1024)} KiB)`);
}
