# 6.am — сборка и деплой

6.am — статический multi-page сайт на Vite и JavaScript. В проекте нет серверной части и внешних API: всё работает в браузере, а настройки и состояние таймеров сохраняются в `localStorage` устройства.

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
- `/time.html#clock`, `/time.html#stopwatch`, `/time.html#pomodoro`, `/time.html#settings` — прямые ссылки на режимы.

Без hash `/time.html` открывает раздел часов. Настройки формата часов и помодоро находятся в общем блоке под основным контентом страницы.

## Production-сборка

```bash
npm run build
npm run check
npm test
npm run smoke
npm run preview
```

Готовые статические файлы находятся в `dist/`. Скрипты и стили подключаются как ES modules/assets и получают хешированные имена. Для проверки публикации в подкаталоге используй `npm run build -- --base /6-am-test/` и `npm run smoke -- --base /6-am-test/`.

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
src/pages/
  index.html            Vite entry point главной страницы
  time.html             Vite entry point приложения времени
src/templates/
  home.pug              шаблон главной страницы
  time.pug              шаблон приложения времени
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
  legacy.css            текущие правила визуальной системы
src/scripts/
  home.js               интерактивность главной
  time.js               часы, секундомер и помодоро
  time-domain.js        чистая логика состояния и восстановления
pages.config.js         единый реестр страниц, маршрутов и выходных имён
```

Чтобы добавить новый сервис, создай Pug-шаблон и entry-страницу в `src/pages/`, затем один раз зарегистрируй source, output и route в `pages.config.js`. Этот реестр используется dev-сервером, production build и smoke-test. Общие визуальные правила держи в `src/styles/`, а логику страницы — в `src/scripts/`.
