# 6.am — сборка и деплой

6.am — статический multi-page сайт на Vite и JavaScript. В проекте нет серверной части и внешних API: всё работает в браузере, а настройки помодоро сохраняются в `localStorage` устройства.

## Требования

- Node.js 20 LTS или новее
- npm 10 или новее

## Локальная разработка

```bash
npm install
npm run dev
```

После запуска открой адрес, который выведет Vite. Основные маршруты:

- `/` — оглавление экосистемы;
- `/time.html` — часы, секундомер и помодоро;
- `/time.html#clock`, `/time.html#stopwatch`, `/time.html#pomodoro` — прямые ссылки на режимы.

## Production-сборка

```bash
npm run build
npm run preview
```

Готовые статические файлы находятся в `dist/`. Перед публикацией достаточно проверить, что открываются `dist/index.html` и `dist/time.html`.

## Cloudflare Pages

1. Создай репозиторий на GitHub и запушь исходный код (после первого успешного `npm install` также добавится `package-lock.json`).
2. В Cloudflare Pages выбери **Create a project → Connect to Git** и нужный репозиторий.
3. Укажи настройки сборки:
   - **Framework preset:** `Vite` (или `None`);
   - **Build command:** `npm run build`;
   - **Build output directory:** `dist`;
   - **Root directory:** `/`.
4. Нажми **Save and Deploy**. Последующие push в выбранную ветку будут собираться автоматически.

Для GitHub Actions можно использовать тот же `npm ci` → `npm run build` → публикацию каталога `dist/` через официальный Cloudflare Pages action или Wrangler. Токены и идентификаторы аккаунта храни в GitHub Secrets, не в репозитории.

## Структура

```text
index.html             оглавление и Vite entry point
time.html              приложение времени и Vite entry point
vite.config.js         явная multi-page-конфигурация Vite
src/styles/
  main.css              единая точка подключения стилей
  tokens.css            дизайн-токены
  base.css              базовые правила и accessibility
  components.css        общие UI-компоненты и иконки
  pages/time.css        стили, специфичные для time.html
  legacy.css            текущие правила визуальной системы
src/scripts/
  home.js               интерактивность главной
  time.js               часы, секундомер и помодоро
```

Чтобы добавить новый сервис, добавь ссылку-карточку в `index.html`, отдельную HTML-точку входа и её ключ в `vite.config.js`. Общие визуальные правила держи в `src/styles/`, а логику страницы — в `src/scripts/`. Текущий `legacy.css` оставлен как безопасный слой совместимости: его можно постепенно разносить по новым файлам без изменения визуального результата.
