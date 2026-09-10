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
| **Tasks** | The next module in the ecosystem | Coming soon |
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

Use **Node.js** and **npm**

```bash
git clone https://github.com/mihailovily/6.am.git
cd 6.am
npm ci
npm run dev
```

Open the local URL printed by Vite. The home page introduces the modules; `/time.html` opens Time.

You can also open a specific view directly:

| View | Path |
| --- | --- |
| Clock | `/time.html#clock` |
| Stopwatch | `/time.html#stopwatch` |
| Pomodoro | `/time.html#pomodoro` |
| Settings | `/time.html#settings` |

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

Publish the contents of **`dist/`** to a static host. No application server or database is needed.

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
