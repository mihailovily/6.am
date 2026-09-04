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

Без hash `/time.html` открывает раздел часов. Настройки формата часов и помодоро находятся в общем блоке под основным контентом страницы.

## Production-сборка

```bash
npm run build
npm run preview
```

Готовые статические файлы находятся в `dist/`. Перед публикацией достаточно проверить, что открываются `dist/index.html` и `dist/time.html`. Сборщик также копирует classic-скрипты в `dist/src/scripts/`, чтобы сохранение поддержки прямого открытия через `file://` не ломало production-вывод.

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
```

Чтобы добавить новый сервис, добавь ссылку-карточку в Pug-шаблон и отдельную entry-страницу в `src/pages/`. Vite обслуживает её через маршруты `/` и `/time.html`, а в production-сборке сохраняет эти имена в `dist/`. Общие визуальные правила держи в `src/styles/`, а логику страницы — в `src/scripts/`. Текущий `legacy.css` оставлен как безопасный слой совместимости: его можно постепенно разносить по новым файлам без изменения визуального результата.
