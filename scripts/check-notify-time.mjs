/**
 * Verifies that patch_notify_time.sql is applied.
 * Usage: node scripts/check-notify-time.mjs
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let ok = true;

// 1) new columns
const { error: colError } = await supabase
  .from('users')
  .select('notify_hour, timezone, last_reminder_date')
  .limit(1);
if (colError) {
  ok = false;
  console.log('❌ columns notify_hour/timezone/last_reminder_date:', colError.message);
} else {
  console.log('✅ columns notify_hour/timezone/last_reminder_date present');
}

const { error: typeColError } = await supabase
  .from('users')
  .select('notify_shopping, notify_expiring, notify_expired')
  .limit(1);

if (typeColError) {
  ok = false;
  console.log('❌ notify type columns:', typeColError.message);
  console.log('   → Apply supabase/patch_notify_types_hourly.sql');
} else {
  console.log('✅ notify_shopping / notify_expiring / notify_expired present');
}

// 2) mark_reminded RPC (empty array = no-op)
const { error: rpcError } = await supabase.rpc('mark_reminded', { user_ids: [] });
if (rpcError) {
  ok = false;
  console.log('❌ mark_reminded():', rpcError.message);
} else {
  console.log('✅ mark_reminded() works');
}

if (!ok) {
  console.log('\n⚠️  Apply missing SQL patches in Supabase SQL Editor, then re-run.');
  process.exit(1);
}
console.log('\n✅ Notification DB schema is ready.');
