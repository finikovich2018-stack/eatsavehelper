type AuthPayload = {
  initData: string;
  telegram_user_id: number;
};

export type ApiFridgeItem = {
  id: string;
  name: string;
  category?: string;
  quantity?: string | null;
  expiry_date?: string | null;
  price?: number | null;
  currency?: string | null;
  icon?: string | null;
  added_from?: string;
  created_at?: string;
  telegram_user_id?: number;
};

export type ApiExpense = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  currency: string;
};

export type ApiBudgetRow = {
  amount: number;
  currency: string;
};

export type ApiReceipt = {
  id: string;
  store_name?: string | null;
  total_amount?: number | null;
  total?: number | null;
  currency?: string;
  scanned_at?: string;
  created_at?: string;
};

export type ApiSavedRecipe = {
  id: string;
  name: string;
  ingredients?: unknown;
  steps?: unknown;
  kcal?: number | null;
  source?: string;
  created_at?: string;
};

export type ApiShoppingItem = {
  id: string;
  name: string;
  quantity?: string | null;
  checked?: boolean;
  source?: string;
  fridge_item_id?: string | null;
  created_at?: string;
};

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || 'Request failed');
  }
  return data as T;
}

export function withAuth(auth: AuthPayload, extra: Record<string, unknown> = {}) {
  return { initData: auth.initData, telegram_user_id: auth.telegram_user_id, ...extra };
}

export const dataApi = {
  home: {
    summary: (auth: AuthPayload, monthStart?: string) =>
      apiPost<{
        expiringItems: ApiFridgeItem[];
        productCount: number;
        expiringSoonCount: number;
        expenses: ApiExpense[];
        budgets: ApiBudgetRow[];
        recipeCount: number;
        shoppingCount: number;
      }>('/api/home', withAuth(auth, { monthStart })),
  },
  fridge: {
    list: (auth: AuthPayload) =>
      apiPost<{ items: ApiFridgeItem[] }>('/api/fridge', withAuth(auth, { op: 'list' })),
    insert: (auth: AuthPayload, items: Partial<ApiFridgeItem>[]) =>
      apiPost<{ items: ApiFridgeItem[] }>('/api/fridge', withAuth(auth, { op: 'insert', items })),
    delete: (auth: AuthPayload, id: string) =>
      apiPost<{ ok: true }>('/api/fridge', withAuth(auth, { op: 'delete', id })),
    consume: (auth: AuthPayload, id: string, action: 'eaten' | 'wasted') =>
      apiPost<{ ok: true; logged: boolean }>(
        '/api/fridge',
        withAuth(auth, { op: 'consume', id, action })
      ),
    stats: (auth: AuthPayload) =>
      apiPost<{
        eaten: number;
        wasted: number;
        wasteFreeDays: number;
        wastedMoney: { currency: string; amount: number }[];
        available: boolean;
      }>('/api/fridge', withAuth(auth, { op: 'stats' })),
    history: (auth: AuthPayload) =>
      apiPost<{
        items: {
          id: string;
          name: string | null;
          category: string | null;
          action: 'eaten' | 'wasted';
          logged_at: string;
          price?: number | null;
          currency?: string | null;
        }[];
      }>('/api/fridge', withAuth(auth, { op: 'history' })),
    count: (auth: AuthPayload) =>
      apiPost<{ count: number }>('/api/fridge', withAuth(auth, { op: 'count' })),
  },
  expenses: {
    list: (auth: AuthPayload, opts?: { monthStart?: string }) =>
      apiPost<{ items: ApiExpense[] }>('/api/expenses', withAuth(auth, { op: 'list', ...opts })),
    insert: (auth: AuthPayload, item: Partial<ApiExpense>) =>
      apiPost<{ item: ApiExpense }>('/api/expenses', withAuth(auth, { op: 'insert', item })),
    delete: (auth: AuthPayload, id: string) =>
      apiPost<{ ok: true }>('/api/expenses', withAuth(auth, { op: 'delete', id })),
  },
  budgets: {
    list: (auth: AuthPayload, month: string) =>
      apiPost<{ items: ApiBudgetRow[] }>('/api/budgets', withAuth(auth, { op: 'list', month })),
    upsert: (auth: AuthPayload, row: { month: string; amount: number; currency: string }) =>
      apiPost<{ ok: true }>('/api/budgets', withAuth(auth, { op: 'upsert', ...row })),
  },
  receipts: {
    list: (auth: AuthPayload, days?: number) =>
      apiPost<{ items: ApiReceipt[] }>('/api/receipts', withAuth(auth, { op: 'list', days: days ?? 7 })),
    insert: (auth: AuthPayload, row: Partial<ApiReceipt>) =>
      apiPost<{ ok: true }>('/api/receipts', withAuth(auth, { op: 'insert', row })),
    count: (auth: AuthPayload) =>
      apiPost<{ count: number }>('/api/receipts', withAuth(auth, { op: 'count' })),
    delete: (auth: AuthPayload, id: string) =>
      apiPost<{ ok: true }>('/api/receipts', withAuth(auth, { op: 'delete', id })),
  },
  recipes: {
    list: (auth: AuthPayload) =>
      apiPost<{ items: ApiSavedRecipe[] }>('/api/saved-recipes', withAuth(auth, { op: 'list' })),
    delete: (auth: AuthPayload, id: string) =>
      apiPost<{ ok: true }>('/api/saved-recipes', withAuth(auth, { op: 'delete', id })),
    count: (auth: AuthPayload, source?: string) =>
      apiPost<{ count: number }>('/api/saved-recipes', withAuth(auth, { op: 'count', source })),
  },
  shopping: {
    list: (auth: AuthPayload) =>
      apiPost<{ items: ApiShoppingItem[] }>('/api/shopping-list', withAuth(auth, { op: 'list' })),
    insert: (
      auth: AuthPayload,
      items: { name: string; quantity?: string; source?: string; fridge_item_id?: string }[]
    ) =>
      apiPost<{ items: ApiShoppingItem[] }>('/api/shopping-list', withAuth(auth, { op: 'insert', items })),
    toggle: (auth: AuthPayload, id: string, checked: boolean) =>
      apiPost<{ item: ApiShoppingItem }>('/api/shopping-list', withAuth(auth, { op: 'toggle', id, checked })),
    delete: (auth: AuthPayload, id: string) =>
      apiPost<{ ok: true }>('/api/shopping-list', withAuth(auth, { op: 'delete', id })),
    clearChecked: (auth: AuthPayload) =>
      apiPost<{ ok: true }>('/api/shopping-list', withAuth(auth, { op: 'clear_checked' })),
    count: (auth: AuthPayload) =>
      apiPost<{ count: number }>('/api/shopping-list', withAuth(auth, { op: 'count' })),
  },
  household: {
    get: (auth: AuthPayload) =>
      apiPost<{
        role: 'owner' | 'member';
        members: { telegram_user_id: number; first_name: string | null; username: string | null; role: string }[];
        memberCount: number;
        maxMembers: number;
        canInvite: boolean;
        ownerHasPremium: boolean;
      }>('/api/household', withAuth(auth, { op: 'get' })),
    invite: (auth: AuthPayload) =>
      apiPost<{ ok: true; link: string; token: string; expiresAt: string }>(
        '/api/household',
        withAuth(auth, { op: 'invite' })
      ),
    leave: (auth: AuthPayload) =>
      apiPost<{ ok: true }>('/api/household', withAuth(auth, { op: 'leave' })),
    removeMember: (auth: AuthPayload, memberTelegramUserId: number) =>
      apiPost<{ ok: true }>(
        '/api/household',
        withAuth(auth, { op: 'remove_member', member_telegram_user_id: memberTelegramUserId })
      ),
  },
  referral: {
    get: (auth: AuthPayload) =>
      apiPost<{
        code: string;
        link: string;
        invited: number;
        bonusDays: number;
        bonusPerInvite: number;
      }>('/api/referral', withAuth(auth)),
  },
};
