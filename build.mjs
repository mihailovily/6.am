import { build } from 'vite';
import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeBase, pages } from './pages.config.js';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const baseArgument = process.argv.indexOf('--base');
const base = baseArgument >= 0 ? normalizeBase(process.argv[baseArgument + 1] || '/') : undefined;

await build({
  configLoader: 'runner',
  root,
  ...(base ? { base } : {})
});

// Keep public page URLs independent from the source layout.
for (const page of Object.values(pages)) {
  await rename(resolve(output, page.source), resolve(output, page.output));
}
await rm(resolve(output, 'src'), { recursive: true, force: true });
