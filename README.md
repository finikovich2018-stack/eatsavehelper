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

5. Дополнительные патчи (по порядку, если ещё не запускали):

   - `supabase/patch_achievements.sql` — достижения и бонус +3 дня
   - `supabase/patch_shopping_list.sql` — список покупок
   - `supabase/patch_household.sql` — семейный Premium
   - `supabase/patch_data_recovery.sql` — восстановление данных после миграции семьи
   - `supabase/patch_expiry_notifications.sql` — push всем членам семьи
   - `supabase/patch_food_reminders.sql` — просрочка + список покупок в push
   - `supabase/patch_referrals.sql` — «Пригласи друга → +3 дня Premium»

6. Скопируйте URL и ключи в `.env.local` и Vercel



## Vercel



Переменные окружения — см. `.env.local.example`

Обязательно в Vercel: `ADMIN_TELEGRAM_IDS=ваш_telegram_id` для страницы `/admin`

**Проект Vercel:** `eatsavehelper-m6hl` → https://eatsavehelper-m6hl.vercel.app (бот и Mini App).

В аккаунте есть второй проект `eatsave` — он **не** используется ботом. Деплой **только** через:

```bash
npm run deploy
```

Не запускайте `npx vercel --prod` вручную: можно случайно выкатить не туда. Целевой проект зафиксирован в `deploy.config.json`, проверки — `npm run check:deploy` и `npm run check:safety`.

В Supabase выполните `supabase/patch_premium_charge_id.sql` (идемпотентность Stars-платежей) и `supabase/patch_atomic_limits.sql` (атомарные рефералы, семья, лимит холодильника).



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



Cron каждый день в **9:00 UTC** (Vercel Cron или [cron-job.org](https://cron-job.org)):

- Эндпоинт: `/api/cron/check-expiry`
- Заголовок: `Authorization: Bearer CRON_SECRET`
- Тест без отправки: `/api/cron/check-expiry?dry_run=1`
- Требует `patch_expiry_notifications.sql` + `patch_household.sql` в Supabase



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


