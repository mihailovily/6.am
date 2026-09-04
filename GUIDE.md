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
index.html       оглавление
time.html        приложение времени
src/style.css    общая дизайн-система и responsive-стили
src/home.js      интерактивность главной
src/time.js      часы, секундомер и помодоро
```

Чтобы добавить новый сервис, добавь ссылку-карточку в `index.html`, а отдельную страницу подключи как новую HTML-точку входа Vite. Общие визуальные правила держи в `src/style.css`, а логику страницы — в отдельном модуле `src/`.
