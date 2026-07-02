/**
 * Full expiring-notification diagnostic (inventory vs hour gate).
 * Usage: node scripts/check-expiring-notify.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function daysLeft(expiryDate) {
  const d = new Date(`${expiryDate}T12:00:00`);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function localHour(timezone) {
  const tz = timezone?.trim() || 'Europe/Moscow';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
}

function localDateStr(timezone) {
  const tz = timezone?.trim() || 'Europe/Moscow';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const MAX_DAYS = 3;

console.log('=== Expiring notification check ===\n');

const { data: items, error: itemsError } = await supabase
  .from('fridge_items')
  .select('name, expiry_date, telegram_user_id, household_id')
  .not('expiry_date', 'is', null);

if (itemsError) {
  console.error('fridge_items error:', itemsError.message);
  process.exit(1);
}

const expiring = (items || [])
  .map((i) => ({ ...i, daysLeft: daysLeft(i.expiry_date) }))
  .filter((i) => i.daysLeft >= 0 && i.daysLeft <= MAX_DAYS)
  .sort((a, b) => a.daysLeft - b.daysLeft);

console.log(`Inventory (≤${MAX_DAYS} days, all users):`);
if (expiring.length === 0) {
  console.log('  (none)\n');
} else {
  expiring.forEach((i) => console.log(`  • ${i.name} — ${i.daysLeft} дн.`));
  console.log('');
}

const { data: users, error: usersError } = await supabase
  .from('users')
  .select(
    'telegram_user_id, first_name, notifications_enabled, notify_hour, timezone, last_reminder_date, telegram_chat_id'
  )
  .eq('notifications_enabled', true);

if (usersError) {
  console.error('users error:', usersError.message);
  process.exit(1);
}

console.log('Users with notifications ON:');
for (const u of users || []) {
  const tz = u.timezone || 'Europe/Moscow';
  const hour = localHour(tz);
  const today = localDateStr(tz);
  const due = hour >= (u.notify_hour ?? 12) && u.last_reminder_date !== today;
  console.log(
    `  • ${u.first_name || u.telegram_user_id}: notify ${String(u.notify_hour ?? 12).padStart(2, '0')}:00 (${tz}), local now ${hour}:00`
  );
  console.log(
    `    chat_id=${u.telegram_chat_id ? 'ok' : 'MISSING'}, last_sent=${u.last_reminder_date ?? 'never'}, due_now=${due ? 'YES' : 'no'}`
  );
}
console.log('');

const { data: rpcRows, error: rpcError } = await supabase.rpc('get_expiring_items', {
  max_days: MAX_DAYS,
});

if (rpcError) {
  console.log('❌ get_expiring_items:', rpcError.message);
  if (rpcError.message.includes('target_date')) {
    console.log('   → Apply supabase/patch_expiring_soon_notify.sql in Supabase');
  }
} else {
  console.log(`get_expiring_items (hour gate, now): ${(rpcRows || []).length} row(s)`);
  (rpcRows || []).forEach((r) =>
    console.log(`  • ${r.item_name} — ${r.days_left} дн. → user ${r.user_telegram_id}`)
  );
}

console.log('\nNote: RPC returns rows only during user notify_hour (or later) if not sent today.');
console.log('Dry run: GET /api/cron/check-expiry?dry_run=1');
