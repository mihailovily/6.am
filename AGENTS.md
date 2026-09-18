# 6.am agent instructions

## Clean page routes

`pages.config.js` drives Vite development, production build, preview and the static smoke test. The Cloudflare Worker has a separate clean-route map in `worker/src/page-routes.js` because `wrangler.jsonc` uses `html_handling: none`.

When adding or renaming a public page, update both registries in the same change:

1. Add its source, output and both clean/`.html` routes to `pages.config.js`.
2. Add the clean route to `worker/src/page-routes.js`, mapping it to the built `.html` asset.
3. Extend the `assetPathFor()` test in `tests/short-domain.test.js` and verify through `npm run dev` at `http://127.0.0.1:8787/<route>`.

Do not assume a successful Vite preview proves the Worker route works.
