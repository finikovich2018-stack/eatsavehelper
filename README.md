# EatSave



Telegram Mini App — умный холодильник + бюджет на продукты.



**Production:** https://eatsavehelper-m6hl.vercel.app/home



## Стек



- **Next.js 14** + TypeScript + Tailwind

- **Supabase** — PostgreSQL (данные через API + service role)

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

2. SQL Editor → `supabase/setup.sql` → **Run**

3. SQL Editor → `supabase/patch_rls.sql` → **Run** (блокировка прямого доступа anon)

4. SQL Editor → `supabase/patch_users_columns.sql` → **Run** (имена пользователей в admin)

5. Скопируйте URL и ключи в `.env.local` и Vercel



## Vercel



Переменные окружения — см. `.env.local.example`

Обязательно в Vercel: `ADMIN_TELEGRAM_IDS=ваш_telegram_id` для страницы `/admin`



После деплоя:



```bash

node scripts/setup.mjs --apply --direct

```



Настроит webhook, кнопку Mini App, описание бота и команды.



## Безопасность



- Клиент **не пишет** в Supabase напрямую — только через `/api/*` с проверкой Telegram `initData`

- RLS закрыт для `anon` — см. `supabase/patch_rls.sql`

- Premium recovery только при записи об оплате Stars в `premium_payments`

- Webhook бота требует `TELEGRAM_WEBHOOK_SECRET` в production



## Push-уведомления



Cron каждый день в **9:00 UTC**:



- Эндпоинт: `/api/cron/check-expiry`

- [cron-job.org](https://cron-job.org) → `Authorization: Bearer CRON_SECRET`



## Premium (Telegram Stars)



- **100 Stars / месяц** — безлимитные сканы, AI-рецепты и продукты

- Оплата через Mini App → `WebApp.openInvoice`

- Webhook `/api/bot` обрабатывает `successful_payment`



## Лимиты Free / Premium



| Функция | Free | Premium |

|---------|------|---------|

| Продуктов в холодильнике | 30 | ∞ |

| Сканов чека / месяц | 3 | ∞ |

| AI-рецептов / месяц | 3 | ∞ |



## Маркетинг



Тексты для BotFather, каналы, KPI — см. [docs/MARKETING.md](docs/MARKETING.md)



## Структура



```

app/           — страницы и API routes

lib/client-api.ts — клиентские вызовы API

components/    — UI, TelegramProvider

supabase/      — SQL (setup.sql + patch_rls.sql)

scripts/       — setup.mjs для Telegram

docs/          — MARKETING.md

```


