/**
 * Local check for food push reminders (no Telegram send).
 * Usage: node scripts/check-food-reminders.mjs
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

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase env in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const targetDate = tomorrow.toISOString().split('T')[0];

console.log('=== EatSave food reminders check ===\n');
console.log('Target date (expiring tomorrow):', targetDate);

const checks = [
  { name: 'get_expiring_items', call: () => supabase.rpc('get_expiring_items', { target_date: targetDate }) },
  { name: 'get_expired_items', call: () => supabase.rpc('get_expired_items', { max_days: 7 }) },
  { name: 'get_shopping_reminders', call: () => supabase.rpc('get_shopping_reminders') },
];

let allOk = true;

for (const { name, call } of checks) {
  const { data, error } = await call();
  if (error) {
    allOk = false;
    console.log(`\n❌ ${name}: ${error.message}`);
    if (error.message.includes('Could not find the function')) {
      console.log('   → Run supabase/patch_food_reminders.sql in Supabase SQL Editor');
    }
    continue;
  }
  console.log(`\n✅ ${name}: ${(data || []).length} row(s)`);
  if (data?.length) {
    const sample = data.slice(0, 5).map((r) => r.item_name || r.name);
    console.log('   Sample:', sample.join(', '));
  }
}

if (!allOk) {
  console.log('\n⚠️  Apply patch_food_reminders.sql, then re-run this script.');
  process.exit(1);
}

console.log('\n✅ All reminder functions work. Cron dry_run:');
console.log('   GET /api/cron/check-expiry?dry_run=1');
console.log('   Authorization: Bearer <CRON_SECRET>');
