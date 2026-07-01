# EatSave — все ссылки и пути

> Сохранено перед перезагрузкой ПК. Секреты (токены, ключи) — только в `.env.local`, здесь их нет.

---

## Проект на компьютере

| Что | Путь |
|-----|------|
| Код проекта | `C:\Users\rasul\Desktop\eatsave` |
| Секреты / env | `C:\Users\rasul\Desktop\eatsave\.env.local` |
| Пример env | `C:\Users\rasul\Desktop\eatsave\.env.local.example` |

---

## Production (живое приложение)

| Что | Ссылка |
|-----|--------|
| **Главная Mini App** | https://eatsavehelper-m6hl.vercel.app/home |
| Корень сайта | https://eatsavehelper-m6hl.vercel.app |
| Проверка конфига | https://eatsavehelper-m6hl.vercel.app/api/setup |
| Webhook бота | https://eatsavehelper-m6hl.vercel.app/api/bot |
| Админ-статистика | https://eatsavehelper-m6hl.vercel.app/admin |
| Туториал (ручное добавление) | https://eatsavehelper-m6hl.vercel.app/tutorial-manual |
| Промо-анимация HTML | https://eatsavehelper-m6hl.vercel.app/promo-video.html |

---

## Telegram

| Что | Ссылка |
|-----|--------|
| **Бот** | https://t.me/EatSavehelper_bot |
| Username бота | `@EatSavehelper_bot` |
| **Канал** | https://t.me/EatSavehelper |
| Открыть Mini App из бота | https://t.me/EatSavehelper_bot/app |
| BotFather (настройки бота) | https://t.me/BotFather |

**Admin Telegram ID:** `173129302` (ваш id для уведомлений и `/admin`)

---

## GitHub и деплой

| Что | Ссылка |
|-----|--------|
| Репозиторий | https://github.com/finikovich2018-stack/eatsavehelper |
| Clone URL | https://github.com/finikovich2018-stack/eatsavehelper.git |
| Vercel (проект) | https://vercel.com/dashboard — проект `eatsavehelper-m6hl` |

Деплой: push в ветку `main` → Vercel собирает автоматически.

---

## Supabase (база данных)

| Что | Ссылка |
|-----|--------|
| Dashboard | https://supabase.com/dashboard |
| Проект (API URL) | https://dyxksakpvdupgutwswlm.supabase.co |
| SQL Editor | Dashboard → Project → SQL Editor |

SQL-скрипты в проекте: `C:\Users\rasul\Desktop\eatsave\supabase\`

---

## AI и сервисы

| Что | Ссылка |
|-----|--------|
| Anthropic Console (бilling / API) | https://console.anthropic.com |
| Google Cloud (Vision OCR, если включите) | https://console.cloud.google.com |

---

## Локальная разработка

```text
cd C:\Users\rasul\Desktop\eatsave
npm run dev          → http://localhost:3000/home
npm run build
npm run start        → production локально (порт из .env, часто 3001)
npm run setup:check  → проверка /api/setup
```

Туториал локально: http://localhost:3000/tutorial-manual?step=1

Пересборка видео/GIF туториала:
```text
npm run build
npm run start
node scripts/capture-tutorial.mjs
```

---

## Файлы на рабочем столе (маркетинг)

| Файл | Описание |
|------|----------|
| `C:\Users\rasul\Desktop\EatSave-manual-add-ru.mp4` | Видео-туториал |
| `C:\Users\rasul\Desktop\EatSave-manual-add-ru.gif` | GIF для Telegram |
| `C:\Users\rasul\Desktop\EatSave-tutorial-slides\` | PNG слайды step-01…05 |
| `C:\Users\rasul\Desktop\EatSave-Ссылки.md` | этот файл |

В проекте: `public\videos\`, `docs\PROMO_VIDEO.md`, `docs\MARKETING.md`

---

## Cron (напоминания о сроке годности)

- Эндпоинт: `GET /api/cron/check-expiry`
- Расписание: **09:00 UTC** (12:00 МСК) ежедневно
- Auth: заголовок `Authorization: Bearer <CRON_SECRET>` из `.env.local`
- Dry run: `?dry_run=1`

---

## Полезные команды бота (для админа)

- Ответ пользователю: **Reply** на сообщение 📩 от бота
- Или: `/reply USER_ID текст`
- Обратная связь: `/feedback` у пользователя

---

*Обновлено: 17 июня 2026*
