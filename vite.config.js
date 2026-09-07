import { defineConfig } from 'vite';
import pug from 'pug';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const pugTag = /<pug\s+src=["']([^"']+)["']\s*\/?><\/pug>/g;

function pugPages() {
  return {
    name: 'pug-pages',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (pathname === '/' || pathname === '/time.html') {
          request.url = `/src/pages${pathname === '/' ? '/index.html' : pathname}`;
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
          result = result.replace(match[0], pug.compile(template, { filename: source })());
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
      input: {
        home: 'src/pages/index.html',
        time: 'src/pages/time.html'
      }
    }
  }
});
