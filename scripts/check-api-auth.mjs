#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(root, 'app', 'api');

const PUBLIC_ROUTES = new Set([
  'bot/route.ts',
  'setup/route.ts',
]);

const PUBLIC_PREFIXES = ['cron/', 'notifications/cron/', 'telegram/'];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(apiRoot, path.join(dir, entry.name)).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(path.join(dir, entry.name), acc);
    else if (entry.name === 'route.ts') acc.push(rel);
  }
  return acc;
}

function isPublicRoute(relPath) {
  if (PUBLIC_ROUTES.has(relPath)) return true;
  return PUBLIC_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

const routes = walk(apiRoot);
const offenders = [];

for (const rel of routes) {
  if (isPublicRoute(rel)) continue;
  const full = path.join(apiRoot, rel);
  const source = fs.readFileSync(full, 'utf8');
  if (!source.includes('verifyApiUser')) {
    offenders.push(rel);
  }
}

if (offenders.length) {
  console.error('API routes missing verifyApiUser():');
  for (const route of offenders) console.error(`  - app/api/${route}`);
  process.exit(1);
}

console.log(`check-api-auth: OK (${routes.length} routes scanned)`);
