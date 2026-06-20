function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_USER = {
  firstName: 'Гульназ',
  username: 'gulnaz_food',
  isPremium: true,
};

export const DEMO_FRIDGE = [
  { id: '1', name: 'Молоко 3.2%', quantity: '1 л', category: 'dairy', icon: '🥛', expiry_date: addDays(2) },
  { id: '2', name: 'Куриное филе', quantity: '600 г', category: 'meat', icon: '🍗', expiry_date: addDays(1) },
  { id: '3', name: 'Яйца C0', quantity: '10 шт', category: 'dairy', icon: '🥚', expiry_date: addDays(12) },
  { id: '4', name: 'Сыр Гouda', quantity: '200 г', category: 'dairy', icon: '🧀', expiry_date: addDays(5) },
  { id: '5', name: 'Помидоры', quantity: '500 г', category: 'veg', icon: '🍅', expiry_date: addDays(3) },
  { id: '6', name: 'Хлеб бородинский', quantity: '1 шт', category: 'grains', icon: '🍞', expiry_date: addDays(2) },
  { id: '7', name: 'Йогурт натуральный', quantity: '2 шт', category: 'dairy', icon: '🥛', expiry_date: addDays(4) },
  { id: '8', name: 'Огурцы', quantity: '4 шт', category: 'veg', icon: '🥒', expiry_date: addDays(3) },
];

export const DEMO_SCAN_ITEMS = [
  { name: 'Молоко 3.2% 1л', price: 89.9, expiry_days: 5, icon: '🥛' },
  { name: 'Хлеб бородинский', price: 45.5, expiry_days: 3, icon: '🍞' },
  { name: 'Яйца C0 10шт', price: 119.0, expiry_days: 14, icon: '🥚' },
  { name: 'Куриное филе 600г', price: 349.9, expiry_days: 2, icon: '🍗' },
  { name: 'Помидоры 500г', price: 129.0, expiry_days: 4, icon: '🍅' },
  { name: 'Сыр 200г', price: 189.0, expiry_days: 10, icon: '🧀' },
];

export const DEMO_SCAN_TOTAL = 922.3;
export const DEMO_SCAN_STORE = 'Пятёрочка';
export const DEMO_SCAN_CURRENCY = 'RUB';

export const DEMO_EXPENSES = [
  { id: '1', name: 'Пятёрочка — чек', amount: 1247.5, date: addDaysAgo(0), category: '🧾', currency: 'RUB' },
  { id: '2', name: 'Молоко и хлеб', amount: 135.4, date: addDaysAgo(1), category: '🛒', currency: 'RUB' },
  { id: '3', name: 'Овощи на рынке', amount: 420, date: addDaysAgo(2), category: '🥬', currency: 'RUB' },
  { id: '4', name: 'Кофе и снеки', amount: 389, date: addDaysAgo(3), category: '☕', currency: 'RUB' },
  { id: '5', name: 'Мясо и рыба', amount: 890, date: addDaysAgo(4), category: '🍗', currency: 'RUB' },
  { id: '6', name: 'Бытовая химия', amount: 456, date: addDaysAgo(5), category: '🧴', currency: 'RUB' },
  { id: '7', name: 'Фрукты', amount: 310, date: addDaysAgo(6), category: '🍎', currency: 'RUB' },
];

export const DEMO_BUDGET = { spent: 8720, limit: 15000, currency: 'RUB' };

export const DEMO_WEEKLY = [
  { label: 'Пн', total: 890 },
  { label: 'Вт', total: 420 },
  { label: 'Ср', total: 135 },
  { label: 'Чт', total: 310 },
  { label: 'Пт', total: 456 },
  { label: 'Сб', total: 1247 },
  { label: 'Вс', total: 389 },
];

export const DEMO_AI_RECIPES = [
  {
    icon: '🍳',
    name: 'Омлет с овощами',
    time: '15 мин',
    steps: 'Взбей яйца, добавь помидоры и сыр. Жарь 5 мин на среднем огне.',
    usesFromFridge: ['Яйца', 'Помидоры', 'Сыр'],
  },
  {
    icon: '🍗',
    name: 'Курица с овощами',
    time: '35 мин',
    steps: 'Обжарь филе, добавь помидоры и огурцы. Туши 20 минут.',
    usesFromFridge: ['Курица', 'Помидоры', 'Огурцы'],
  },
];

export const DEMO_SAVED_RECIPE = {
  icon: '🍲',
  name: 'Суп из курицы',
  ingredients: ['Куриное филе', 'Морковь', 'Лук', 'Картофель'],
};

export const DEMO_RECEIPTS = [
  { id: '1', store_name: 'Пятёрочка', total_amount: 1247.5, currency: 'RUB', scanned_at: new Date().toISOString() },
  { id: '2', store_name: 'Магнит', total_amount: 856.3, currency: 'RUB', scanned_at: addDaysAgo(2) + 'T14:20:00.000Z' },
  { id: '3', store_name: 'ВкусВилл', total_amount: 2130, currency: 'RUB', scanned_at: addDaysAgo(4) + 'T11:05:00.000Z' },
];

export const DEMO_STATS = {
  fridgeCount: 8,
  byCurrency: { RUB: 8720 },
  receiptCount: 12,
  aiRecipeCount: 5,
  budgetLimit: 15000,
  primaryCurrency: 'RUB',
};

export function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export const CAT_LABELS: Record<string, string> = {
  all: 'Все',
  dairy: 'Молочка',
  meat: 'Мясо',
  veg: 'Овощи',
  grains: 'Крупы',
  other: 'Другое',
};
