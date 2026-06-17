# EatSave

Telegram Mini App — умный холодильник + бюджет на продукты.

## Стек

- **Next.js 14** + TypeScript + Tailwind
- **Supabase** — PostgreSQL
- **Anthropic Claude** — скан чеков и AI-рецепты
- **Telegram Bot** — webhook, Premium Stars, push-уведомления
- **Vercel** — хостинг

## Быстрый старт

```bash
npm install
cp .env.local.example .env.local
# заполните .env.local
npm run dev
```

Откройте http://localhost:3000/home

## Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. SQL Editor → вставьте `supabase/setup.sql` → **Run**
3. Скопируйте URL и ключи в `.env.local` и Vercel

## Vercel

Переменные окружения — см. `.env.local.example`

После деплоя:

```bash
node scripts/setup.mjs --apply
```

Настроит webhook и кнопку Mini App в Telegram.

## Telegram Bot

1. [@BotFather](https://t.me/BotFather) → создайте бота
2. **Bot Settings → Menu Button** → URL: `https://ваш-домен.vercel.app/home`
3. Команды бота:
   - `/start` — подписка на уведомления + кнопка Mini App
   - `/subscribe` / `/unsubscribe` — вкл/выкл напоминания
   - `/status` — Premium и уведомления

## Push-уведомления

Cron каждый день в **9:00 UTC** (`vercel.json`):

- Эндпоинт: `/api/cron/check-expiry`
- Напоминает о продуктах, которые **истекают завтра**
- Нужны: `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `telegram_chat_id` у пользователя

## Premium (Telegram Stars)

- **100 Stars / месяц** — безлимитные сканы, AI-рецепты и продукты
- Оплата через `/api/create-premium-invoice` → `WebApp.openInvoice`
- Webhook `/api/bot` обрабатывает `successful_payment`

## Лимиты Free / Premium

| Функция | Free | Premium |
|---------|------|---------|
| Продуктов в холодильнике | 30 | ∞ |
| Сканов чека / месяц | 3 | ∞ |
| AI-рецептов / месяц | 3 | ∞ |

## Структура

```
app/           — страницы и API routes
components/    — UI, TelegramProvider
lib/           — Supabase, AI, константы
supabase/      — SQL миграции
scripts/       — setup.mjs для Telegram
```
