# 6.am — заметки для будущих редакторов

Этот файл описывает текущее устройство сайта и рабочие соглашения, которые важно учитывать при следующих изменениях.

## Назначение

6.am — небольшой статический multi-page сайт на Vite, Pug и vanilla JavaScript. Серверной части и внешних API нет. Всё состояние приложения времени живёт в браузере; пользовательские настройки помодоро сохраняются в `localStorage`.

## Публичные точки входа

Внешние маршруты:

- `/` — главная страница-оглавление;
- `/time.html` — часы, секундомер, помодоро и настройки;
- `/time.html#clock`, `/time.html#stopwatch`, `/time.html#pomodoro`, `/time.html#settings` — прямые ссылки на режимы приложения времени.

При открытии `/time.html` без hash по умолчанию активен режим `clock`. Hash сохраняет приоритет и позволяет сразу открыть любой другой режим.

Исходные Vite entry-файлы находятся не в корне:

```text
src/pages/index.html
src/pages/time.html
```

Это минимальные HTML-файлы с одним `<pug src="…">`. Они нужны Vite как точки входа; фактическая разметка находится в Pug-шаблонах.

## Pug-шаблоны

```text
src/templates/
  home.pug       разметка главной страницы
  time.pug       разметка приложения времени
  _head.pug      общий head: meta, title, stylesheet
  _header.pug    общий логотип
  _footer.pug    общий footer с названием проекта и ссылкой автора
```

В `home.pug` и `time.pug` перед `doctype` задаются локальные значения `title` и `description`, которые используются общим partial-шаблоном `_head.pug`.

При добавлении общей части сначала стоит вынести её в partial с префиксом `_`, а затем подключить через `include`. Не дублировать header/footer в страницах.

## Vite и сборка

Конфигурация находится в `vite.config.js`.

В проекте используется небольшой локальный плагин `pug-pages`:

- ищет в HTML теги `<pug src="…"></pug>`;
- компилирует указанный файл через пакет `pug`;
- разрешает путь шаблона относительно текущего HTML entry-файла;
- в dev переписывает `/` на `/src/pages/index.html` и `/time.html` на `/src/pages/time.html`.

`--configLoader runner` в `npm run dev` и в `build.mjs` нужен для корректной загрузки ESM-конфига с импортом Pug в текущем окружении.

Команды:

```bash
npm install
npm run dev       # локальная разработка
npm run build     # production-сборка в dist/
npm run preview   # просмотр dist через Vite
npm run check     # tsc --noEmit
npm test          # unit-тесты доменной логики
npm run smoke     # HTTP/MIME-проверка dist
```

`npm run build` запускает `build.mjs`, а не обычный `vite build`. Скрипт:

1. читает единый реестр страниц из `pages.config.js`;
2. собирает Pug, CSS и ES modules через Vite;
3. переносит зарегистрированные HTML outputs в публичный корень `dist/`;
4. удаляет временную вложенную директорию `dist/src`.

После сборки ожидается:

```text
dist/index.html
dist/time.html
dist/assets/*.css
dist/assets/*.js
```

Прямое открытие исходных страниц через `file://` больше не является поддерживаемым сценарием. Использовать `npm run dev` или `npm run preview`.

## Клиентская логика

- `src/scripts/time.js` — переключение режимов, часы с выбираемым IANA-часовым поясом и подписью, секундомер, помодоро, настройки и звуковой сигнал. Настройки открываются отдельным режимом `#settings`.
- `src/scripts/time-domain.js` — чистые переходы состояния, нормализация настроек/runtime snapshot и fallback часовых поясов.

Ключевые DOM-контракты приложения времени — все элементы с ID в `src/templates/time.pug` (например, `#pomodoro-toggle`, `#clock-digits`, `#stopwatch-toggle`, `#settings-form`). При переименовании ID нужно одновременно менять селекторы в `src/scripts/time.js`.

Настройки хранятся под ключом `6am-preferences`; для обратной совместимости чтение также проверяет `winter-arc-preferences`. Версионированное состояние помодоро и секундомера хранится под ключом `6am-runtime`; работающие таймеры восстанавливаются по абсолютным timestamps.

## Стили

`src/styles/main.css` — единая точка подключения стилей. Внутри подключаются базовые стили, токены, компоненты и page-specific CSS. В `src/styles/pages/time.css` описаны режимы, адаптивная навигация и прокручиваемый список кругов секундомера.

```text
src/styles/
  main.css
  tokens.css       дизайн-токены
  base.css         базовые правила и accessibility
  components.css   общие UI-компоненты и SVG-иконки
  pages/time.css   стили страницы времени
```

Существующий визуальный язык описан в [DESIGN_GUIDE.md](DESIGN_GUIDE.md). Замечания и ограничения проверки — в [DESIGN_REVIEW.md](DESIGN_REVIEW.md), сценарии приёмки — в [DESIGN_CHECKLIST.md](DESIGN_CHECKLIST.md). При изменении визуала сверяться с гайдом и обновлять его вместе с исходниками; рекомендации ревью не считать уже реализованными.

## Проверка изменений

Минимальная проверка после редактирования шаблонов:

```bash
npm run build
npm run check
npm test
npm run smoke
npm run preview
```

В dev нужно проверить `/` и `/time.html`, а для страницы времени — четыре hash-режима. После build `npm run smoke` проверяет обе страницы, локальные `href/src`, существование ассетов и их MIME.

`npm run check` выполняет строгую проверку JavaScript через TypeScript `checkJs`; публичные структуры доменной логики типизированы JSDoc.

## UI-соглашения

- Header главной содержит только логотип. Header Time описан отдельно в `time.pug` и содержит логотип, четыре вкладки режимов и код раздела.
- Footer содержит `6.am` и ссылку на автора `mihailovily` (`https://mihailovily.github.io/`).
- Главная использует английский hero-текст: `Less noise. More focus.` и `A set of tools for productive work.`
- Favicon — `public/favicon.svg`, простой чёрный квадрат; подключается из общего `_head.pug`.
- В Time используются английские заголовки: приветствие Clock, `Every second in its place.` в Stopwatch, `Time to focus.` / `A break is part of the work.` в Pomodoro. Доступность мобильных вкладок и фокуса числовых полей требует исправлений, указанных в дизайн-ревью.

## Важные соглашения

- Не возвращать entry-файлы в корень без необходимости: текущая структура специально отделяет исходные страницы от корневой документации и конфигурации.
- При добавлении новой страницы создать entry в `src/pages`, Pug-шаблон в `src/templates` и одну запись в `pages.config.js`.
- Не менять публичные имена `dist/index.html` и `dist/time.html` без одновременного обновления ссылок и deployment-документации.
- Исходные стили и ES modules подключаются через Vite, который добавляет deployment `base`; внутренние ссылки получают тот же `base` при компиляции Pug.
