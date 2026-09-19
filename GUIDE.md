# 6.am — сборка и деплой

6.am — multi-page сайт на Vite и JavaScript со статическими страницами и Cloudflare Worker. Time продолжает работать только в браузере; Life использует Worker для stateless PNG-обоев, а Note — Worker и D1 для временных зашифрованных заметок и сокращённых URL.

## Требования

- Node.js 24 LTS
- npm 12

## Локальная разработка

```bash
npm install
npm run dev
```

`npm run dev` сначала соберёт assets и применит D1 migration локально, затем запустит Worker, который сам отдаёт assets, API и `/shrt/*` на одном URL (обычно `http://localhost:8787/`). В этой команде только для localhost включены bypass Turnstile и Access; `wrangler deploy` их не получает. Для работы только со статической вёрсткой есть `npm run dev:ui`.

После запуска открой адрес, который выведет Worker. Основные маршруты:

- `/` — оглавление экосистемы;
- `/time` — часы, секундомер и помодоро;
- `/life` — генератор ежедневных Life, Year и Goal обоев;
- `/note` — публичное создание временной зашифрованной заметки;
- `/note-admin` — создание сокращённой ссылки для владельца через Cloudflare Access;
- `/note-view` — страница расшифровки заметки;
- `/shrt/{code}` — короткая ссылка или полученная заметка;
- `/time#clock`, `/time#stopwatch`, `/time#pomodoro`, `/time#settings` — прямые ссылки на режимы.

Life генерирует PNG через `GET /api/v1/life/wallpaper.png`. Параметры календаря, IANA-таймзона и цвета `background`, `past`, `future`, `current` находятся в query string и не сохраняются в D1; постоянную ссылку можно использовать в iOS Shortcuts или MacroDroid. Выбранные во вкладке Settings таймзона и палитра дополнительно сохраняются в браузере под ключом `6am-life-settings-v1`, а Reset удаляет только эти локальные предпочтения.

Пути с `.html` также доступны без редиректа. Без hash `/time` после инициализации открывает раздел часов. Настройки формата часов, часового пояса, подписи и помодоро находятся в отдельном режиме `/time#settings`.

## Дизайн-документация

- [DESIGN_GUIDE.md](DESIGN_GUIDE.md) — текущие токены, типографика, компоненты, состояния и адаптивность.
- [DESIGN_REVIEW.md](DESIGN_REVIEW.md) — замечания по исходникам, приоритеты и границы проверки.
- [DESIGN_CHECKLIST.md](DESIGN_CHECKLIST.md) — сценарии визуальной и клавиатурной приёмки.

## Production-сборка

```bash
npm run build
npm run check
npm run lint:css
npm test
npm run smoke
npm run preview
```

Готовые статические файлы находятся в `dist/`. Скрипты и стили подключаются как ES modules/assets и получают хешированные имена. Для проверки публикации в подкаталоге используй `npm run build -- --base /6-am-test/` и `npm run smoke -- --base /6-am-test/`.

## Cloudflare Worker и D1

`wrangler.jsonc` описывает единый Worker `6-am`: он сначала обрабатывает API и `/shrt/*`, а затем отдаёт собранные assets из `dist/`. Docker и Cloudflare Pages для этой конфигурации не нужны.

1. В Cloudflare создай D1 database `6-am` и подставь её ID вместо `REPLACE_WITH_D1_DATABASE_ID` в `wrangler.jsonc`.
2. Выполни миграции: `npx wrangler d1 migrations apply 6-am --remote`.
3. Создай Worker secrets: `TURNSTILE_SECRET_KEY`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. Публичный Turnstile site key передаётся сборке через `VITE_TURNSTILE_SITE_KEY`.
4. В Cloudflare Zero Trust создай Access applications для `/note-admin`, `/note-admin.html` и `/api/v1/admin/*`, с Allow policy для вашего Cloudflare account member или выбранного IdP. Оба URL страницы владельца должны быть защищены. Переход на `https://6am.milya.site/note-admin` покажет Cloudflare login, а затем owner-форму. Worker дополнительно проверяет `CF-Access-Jwt-Assertion`.
5. В WAF добавь rate-limit для `POST /api/v1/notes` (рекомендованное начальное значение: 10 запросов с IP за 10 минут).
6. Собери и проверь bundle: `npm run build`, `npx wrangler deploy --dry-run`. Для публикации используй обычный Git-connected deploy либо `npx wrangler deploy` после проверки.

В `wrangler.jsonc` также есть ежедневный Cron: он удаляет истёкшие записи. Независимо от Cron Worker сверяет `expires_at` на каждом чтении, поэтому просроченный ресурс не станет доступен.

## Структура

```text
src/pages/
  index.html            Vite entry point главной страницы
  time.html             Vite entry point приложения времени
  life.html             Vite entry point Life
  note.html             Vite entry point Note
src/templates/
  home.pug              шаблон главной страницы
  time.pug              шаблон приложения времени
  life.pug              генератор обоев Life
  note*.pug             создание, раскрытие и admin-страницы Note
  _head.pug             общая head-секция
  _header.pug           общий header
  _footer.pug           общий footer
public/
  favicon.svg           favicon — чёрный квадрат
src/styles/
  main.css              единая точка подключения стилей
  tokens.css            дизайн-токены
  base.css              базовые правила и accessibility
  components.css        общие UI-компоненты и иконки
  pages/time.css        стили, специфичные для time.html
  pages/life.css        стили Life
  pages/note.css        стили Note
src/scripts/
  time.js               часы, секундомер и помодоро
  time-domain.js        чистая логика состояния и восстановления
  life*.js              UI, расчёты календарей и SVG-модель Life
  note*.js              UI и Web Crypto для Note
worker/
  src/                  router, Life PNG renderer, Access JWT adapter и short-code logic
  migrations/           D1 schema для resources и identity
pages.config.js         единый реестр страниц, маршрутов и выходных имён
```

Чтобы добавить новый сервис, создай Pug-шаблон и entry-страницу в `src/pages/`, затем зарегистрируй source, output и route в `pages.config.js`. Этот реестр используется dev-сервером, production build и smoke-test. Если путь должен работать через Cloudflare Worker без `.html`, добавь ту же clean-route запись в `worker/src/page-routes.js`: в `wrangler.jsonc` включён `html_handling: none`, поэтому Worker не выводит это соответствие автоматически. Общие визуальные правила держи в `src/styles/`, а логику страницы — в `src/scripts/`. `npm run lint:css` запрещает raw colors вне `tokens.css` и дублирующиеся селекторы.
