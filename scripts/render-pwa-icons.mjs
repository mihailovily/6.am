import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@cf-wasm/resvg';

const source = await readFile('public/icons/6am-app-icon.svg', 'utf8');
const outputs = [
  ['public/icons/6am-192.png', 192, source],
  ['public/icons/6am-512.png', 512, source],
  ['public/icons/6am-maskable-512.png', 512, source],
  ['public/apple-touch-icon.png', 180, source]
];

for (const [destination, size, svg] of outputs) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  await writeFile(destination, image.asPng());
}
