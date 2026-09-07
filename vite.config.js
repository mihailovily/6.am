import { defineConfig } from 'vite';
import pug from 'pug';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pageInputs, pages, normalizeBase } from './pages.config.js';

const pugTag = /<pug\s+src=["']([^"']+)["']\s*\/?><\/pug>/g;

function pugPages() {
  let base = '/';
  return {
    name: 'pug-pages',
    configResolved(config) {
      base = normalizeBase(config.base);
    },
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const basePrefix = base === '/' ? '' : base.slice(0, -1);
        const route = basePrefix && pathname.startsWith(`${basePrefix}/`) ? pathname.slice(basePrefix.length) : pathname;
        const page = Object.values(pages).find((candidate) => candidate.routes.includes(route));
        if (page) {
          request.url = `${basePrefix}/${page.source}`;
        }
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        const matches = [...html.matchAll(pugTag)];
        let result = html;
        for (const match of matches) {
          const source = resolve(dirname(context.filename), match[1]);
          const template = await readFile(source, 'utf8');
          result = result.replace(match[0], pug.compile(template, { filename: source })({ base }));
        }
        return result;
      }
    }
  };
}

export default defineConfig({
  plugins: [pugPages()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: pageInputs(process.cwd())
    }
  }
});
