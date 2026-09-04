import { build } from 'vite';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');

await build({
  configLoader: 'runner',
  root,
  build: {
    outDir: output,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(root, 'src/pages/index.html'),
        time: resolve(root, 'src/pages/time.html')
      }
    }
  }
});

// Keep public page URLs independent from the source layout.
const pagesOutput = resolve(output, 'src/pages');
await rename(resolve(pagesOutput, 'index.html'), resolve(output, 'index.html'));
await rename(resolve(pagesOutput, 'time.html'), resolve(output, 'time.html'));
await rm(resolve(output, 'src'), { recursive: true, force: true });

// These are classic scripts on purpose: they also work when source HTML is opened with file://.
const scriptsOutput = resolve(output, 'src/scripts');
await mkdir(scriptsOutput, { recursive: true });
await cp(resolve(root, 'src/scripts/home.js'), resolve(scriptsOutput, 'home.js'));
await cp(resolve(root, 'src/scripts/time.js'), resolve(scriptsOutput, 'time.js'));
