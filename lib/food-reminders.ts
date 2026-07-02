import type { SupabaseClient } from '@supabase/supabase-js';
import { greetingWithName } from '@/lib/greeting';

export type ReminderUser = {
  telegram_user_id: number;
  first_name: string | null;
  chat_id: number;
  expiringSoon: { name: string; daysLeft: number }[];
  expired: { name: string; daysOverdue: number }[];
  toBuy: { name: string; quantity: string | null }[];
};

type ExpiringRow = {
  user_telegram_id: number;
  first_name: string | null;
  item_name: string;
  days_left: number;
  chat_id: number;
};

type ExpiredRow = ExpiringRow & {
  days_overdue: number;
};

type ShoppingRow = ExpiringRow & {
  quantity: string | null;
};

export type FoodReminderFetch = {
  users: ReminderUser[];
  maxDays: number;
  rpcErrors: string[];
};

const EXPIRING_SOON_DAYS = 3;

export async function fetchFoodReminders(supabase: SupabaseClient): Promise<FoodReminderFetch> {
  const rpcErrors: string[] = [];
  const byUser = new Map<number, ReminderUser>();

  const ensureUser = (row: { user_telegram_id: number; first_name: string | null; chat_id: number }) => {
    if (!row.chat_id) return null;
    let user = byUser.get(row.user_telegram_id);
    if (!user) {
      user = {
        telegram_user_id: row.user_telegram_id,
        first_name: row.first_name,
        chat_id: row.chat_id,
        expiringSoon: [],
        expired: [],
        toBuy: [],
      };
      byUser.set(row.user_telegram_id, user);
    }
    return user;
  };

  const { data: expiringRows, error: expiringError } = await supabase.rpc('get_expiring_items', {
    max_days: EXPIRING_SOON_DAYS,
  });
  if (expiringError) {
    rpcErrors.push(`get_expiring_items: ${expiringError.message}`);
  } else {
    for (const row of (expiringRows || []) as ExpiringRow[]) {
      const user = ensureUser(row);
      if (user && !user.expiringSoon.some((i) => i.name === row.item_name)) {
        user.expiringSoon.push({ name: row.item_name, daysLeft: row.days_left });
      }
    }
  }

  const { data: expiredRows, error: expiredError } = await supabase.rpc('get_expired_items', {
    max_days: 7,
  });
  if (expiredError) {
    rpcErrors.push(`get_expired_items: ${expiredError.message}`);
  } else {
    for (const row of (expiredRows || []) as ExpiredRow[]) {
      const user = ensureUser(row);
      if (user && !user.expired.some((i) => i.name === row.item_name)) {
        user.expired.push({ name: row.item_name, daysOverdue: row.days_overdue });
      }
    }
  }

  const { data: shoppingRows, error: shoppingError } = await supabase.rpc('get_shopping_reminders');
  if (shoppingError) {
    rpcErrors.push(`get_shopping_reminders: ${shoppingError.message}`);
  } else {
    for (const row of (shoppingRows || []) as ShoppingRow[]) {
      const user = ensureUser(row);
      if (user && !user.toBuy.some((i) => i.name === row.item_name)) {
        user.toBuy.push({ name: row.item_name, quantity: row.quantity });
      }
    }
  }

  const users = Array.from(byUser.values()).filter(
    (u) => u.expiringSoon.length > 0 || u.expired.length > 0 || u.toBuy.length > 0
  );

  return { users, maxDays: EXPIRING_SOON_DAYS, rpcErrors };
}

export function buildFoodReminderMessage(user: ReminderUser): string | null {
  const sections: string[] = [];
  const name = user.first_name || 'друг';

  if (user.toBuy.length > 0) {
    const lines = user.toBuy
      .slice(0, 10)
      .map((i) => `• <b>${i.name}</b>${i.quantity ? ` (${i.quantity})` : ''}`)
      .join('\n');
    sections.push(`🛒 <b>Купить:</b>\n${lines}`);
  }

  if (user.expiringSoon.length > 0) {
    const lines = user.expiringSoon
      .slice(0, 10)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .map((item) => {
        const when =
          item.daysLeft <= 0
            ? 'сегодня'
            : item.daysLeft === 1
              ? 'завтра'
              : `через ${item.daysLeft} дн.`;
        return `• <b>${item.name}</b> (${when})`;
      })
      .join('\n');
    sections.push(`⏰ <b>Скоро испортится:</b>\n${lines}`);
  }

  if (user.expired.length > 0) {
    const lines = user.expired
      .slice(0, 10)
      .map((i) => {
        const days =
          i.daysOverdue === 1 ? '1 день назад' : `${i.daysOverdue} дн. назад`;
        return `• <b>${i.name}</b> (${days})`;
      })
      .join('\n');
    sections.push(`❌ <b>Просрочено — уберите из холодильника:</b>\n${lines}`);
  }

  if (sections.length === 0) return null;

  let headerIcon = '🔔';
  if (user.toBuy.length > 0 && user.expiringSoon.length === 0 && user.expired.length === 0) {
    headerIcon = '🛒';
  } else if (user.expiringSoon.length > 0 && user.toBuy.length === 0 && user.expired.length === 0) {
    headerIcon = '⏰';
  } else if (user.expired.length > 0 && user.toBuy.length === 0 && user.expiringSoon.length === 0) {
    headerIcon = '❌';
  }

  return (
    `${headerIcon} <b>EatSave — напоминание</b>\n\n` +
    `${greetingWithName(name)}\n\n` +
    `${sections.join('\n\n')}\n\n` +
    `Откройте приложение, чтобы обновить холодильник и список покупок.`
  );
}

export function reminderAppPath(user: ReminderUser): '/shopping' | '/home' {
  const shoppingOnly =
    user.toBuy.length > 0 &&
    user.expiringSoon.length === 0 &&
    user.expired.length === 0;
  return shoppingOnly ? '/shopping' : '/home';
}

export function reminderPreview(user: ReminderUser) {
  return {
    telegram_user_id: user.telegram_user_id,
    chat_id: user.chat_id,
    expiring_soon: user.expiringSoon,
    expired: user.expired.map((i) => i.name),
    to_buy: user.toBuy.map((i) => i.name),
  };
}
