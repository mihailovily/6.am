# 6.am

**Less noise. More focus.**

Open-source tools for productive work. A calm space for keeping time, finding focus, and building a daily rhythm — ready to host on your own static hosting service.

[![CI](https://github.com/mihailovily/6.am/actions/workflows/ci.yml/badge.svg)](https://github.com/mihailovily/6.am/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## A space for focus

6.am starts with **Time**: a clock, stopwatch, and Pomodoro timer in one minimal interface. Large typography, a dark palette, and fullscreen views keep the active tool at the center of your workspace.

| Module | What it does | Status |
| --- | --- | --- |
| **Time** | Clock, stopwatch, and customizable Pomodoro | Available |
| **QR** | Local QR/barcode generation, export, and scanning | Available |
| **Tasks** | The next module in the ecosystem | Coming soon |
| **Note** | Encrypted temporary notes and expiring short links | Available |
| **Rituals** | A place for repeatable practices | Coming soon |

### Time

- **Clock** — choose a time zone, switch between 12- and 24-hour formats, and add a custom label.
- **Stopwatch** — start, pause, reset, and record laps with individual and total times.
- **Pomodoro** — customize focus sessions, short and long breaks, and the number of sessions before a long break. Enable automatic phase transitions when you want them.
- **Sound alerts** — choose separate sounds after focus and breaks, preview them, adjust the volume, or use your own audio file up to 5 MB.
- **Fullscreen** — give the clock, stopwatch, or Pomodoro its own focused view.

### Your browser, your settings

No account or backend is required. The tools run in your browser without external APIs.

Preferences and timer state are saved in `localStorage`; custom audio is stored locally in IndexedDB when browser storage is available. Time is recalculated when you return to the page. Saved data belongs to that browser and device, with no cloud sync.

## Quick start

Use **Node.js 24 LTS** and **npm 12**. The exact Node.js version used by CI is recorded in `.nvmrc`; the npm version is recorded in `package.json`.

```bash
git clone https://github.com/mihailovily/6.am.git
cd 6.am
npm ci
npm run dev
```

Open the local URL printed by the Worker. The home page introduces the modules; `/time` opens Time and `/note` opens Note. Existing `.html` URLs continue to work too.

`npm run dev` starts a local D1 database and the Worker that serves the built assets, so use the Worker URL it prints (normally `http://localhost:8787/`). It also enables local-only Turnstile and Access bypasses, so note creation and the owner UI work end-to-end. `npm run dev:ui` is available when only static-page work is needed.

You can also open a specific view directly:

| View | Path |
| --- | --- |
| Clock | `/time#clock` |
| Stopwatch | `/time#stopwatch` |
| Pomodoro | `/time#pomodoro` |
| Settings | `/time#settings` |
| QR generator and reader | `/qr` |
| Note | `/note` |
| Note owner | `/note-admin` |

## Built to stay simple

6.am is a static, multi-page site built with **Vite**, **Pug**, **vanilla JavaScript**, and **CSS**. TypeScript checks the JavaScript source, and Node's built-in test runner covers timer state and recovery logic.

```text
src/
  pages/          HTML entry points
  templates/      Pug pages and shared layout
  scripts/        Time UI and timer state logic
  styles/         Design tokens, shared styles, and page styles
public/           Local fonts, sounds, and favicon
tests/            Timer state and recovery tests
scripts/          Build verification and sound generation
pages.config.js   Page and route registry
```

### Development checks

```bash
npm run check
npm run lint:css
npm test
npm run build
npm run smoke
```

These check JavaScript types, CSS rules, timer logic, the production build, and generated pages and assets. Run the build before the smoke check, which inspects `dist/`.

## Host it yourself

Build the site and preview the production output locally:

```bash
npm run build
npm run preview
```

Publish the contents of **`dist/`** to a static host. No application server or database is needed for the static pages. Configure the host to rewrite `/time`, `/qr`, `/note`, `/note-admin`, and `/note-view` to their matching `.html` files without redirecting; the legacy `.html` paths remain available.

The Note service extends this static site with a Cloudflare Worker and D1. Configure the real `database_id` in `wrangler.jsonc`, run `npx wrangler d1 migrations apply 6-am --remote`, and set `TURNSTILE_SECRET_KEY`, `ACCESS_TEAM_DOMAIN`, and `ACCESS_AUD` as Worker secrets. The public Turnstile site key is supplied at build time as `VITE_TURNSTILE_SITE_KEY`. Cloudflare Access must protect both `/note-admin` and `/note-admin.html`, plus `/api/v1/admin/*`, in the dashboard.

For a deployment under a subdirectory, set its base path at build time:

```bash
npm run build -- --base /6.am/
npm run smoke -- --base /6.am/
```

See the [build and deployment guide](GUIDE.md) for more details, including Cloudflare Pages setup. The guide is written in Russian.

## Documentation

- [Build and deployment](GUIDE.md) — local setup, routing, and hosting (Russian).
- [Current design system](DESIGN_GUIDE.md) — tokens, typography, and components.
- [Design review](DESIGN_REVIEW.md) — findings and areas for refinement.
- [UI acceptance checklist](DESIGN_CHECKLIST.md) — visual and keyboard verification scenarios.

## License

[MIT](LICENSE) · Made by [mihailovily](https://mihailovily.github.io/).
