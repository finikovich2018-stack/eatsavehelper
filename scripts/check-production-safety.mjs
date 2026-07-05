#!/usr/bin/env node
/**
 * Static checks for production safety regressions.
 * Run in CI: npm run check:safety
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const offenders = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function forbid(pattern, rel, message) {
  const text = read(rel);
  if (pattern.test(text)) offenders.push(`${rel}: ${message}`);
}

forbid(
  /CRON_SECRET\s*\|\|\s*process\.env\.TELEGRAM_WEBHOOK_SECRET/,
  'app/api/cron/weekly-digest/route.ts',
  'cron must not fall back to TELEGRAM_WEBHOOK_SECRET'
);
forbid(
  /CRON_SECRET\s*\|\|\s*process\.env\.TELEGRAM_WEBHOOK_SECRET/,
  'app/api/cron/check-expiry/route.ts',
  'cron must not fall back to TELEGRAM_WEBHOOK_SECRET'
);

const verifyApi = read('lib/verify-api-user.ts');
if (!verifyApi.includes("process.env.NODE_ENV !== 'production'")) {
  offenders.push('lib/verify-api-user.ts: ALLOW_DEV_AUTH must be blocked in production');
}

const premium = read('lib/premium-payments.ts');
if (!premium.includes('processSuccessfulPremiumPayment')) {
  offenders.push('lib/premium-payments.ts: missing idempotent processSuccessfulPremiumPayment');
}
if (!premium.includes(".eq('activated', false)")) {
  offenders.push('lib/premium-payments.ts: recovery must require activated=false');
}

for (const rel of ['app/shopping/page.tsx', 'app/recipes/page.tsx', 'app/profile/page.tsx']) {
  const text = read(rel);
  if (!text.includes('userCacheKey')) {
    offenders.push(`${rel}: session cache must be scoped with userCacheKey`);
  }
}

if (!read('package.json').includes('check:safety')) {
  offenders.push('package.json: missing check:safety script');
}

if (offenders.length) {
  console.error('check:safety failed:\n' + offenders.map((o) => `  - ${o}`).join('\n'));
  process.exit(1);
}

console.log('check:safety OK');
