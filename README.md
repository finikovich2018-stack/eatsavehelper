# EatSave

Telegram Mini App — умный холодильник и умные рецепты.

## Стек

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- @telegram-apps/sdk
- Zustand + React Query

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Скопируйте переменные окружения:

```bash
cp .env.local.example .env.local
```

3. Заполните `.env.local` (Supabase, Telegram Bot Token и др.)

4. Запустите dev-сервер:

```bash
npm run dev
```

5. Откройте [http://localhost:3000](http://localhost:3000)

## Структура

- `app/` — страницы и API routes
- `components/` — UI-компоненты
- `lib/` — Supabase, Telegram, AI
- `store/` — Zustand stores
- `supabase/migrations/` — SQL-схема БД

## Разработка по промптам

Проект создаётся пошагово по документу EatSave_Cursor_Prompts:

1. ✅ Базовая структура (текущий этап)
2. Supabase + авторизация Telegram
3. Экран холодильника
4. Сканер чека
5. Рецепты + AI
6. Бюджет
7. Профиль + Premium
8. Главная + финальная сборка
9. Cloudflare Worker
