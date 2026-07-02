#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_CAPTURE_MARKERS = [
  'tgWebAppData',
  "getEntriesByType('navigation')",
  'purgeSw',
  '__EATSAVE_CAPTURE_TG__',
  'launchParams',
  'eatsave_tg_init',
];

const capturePath = path.join(root, 'lib', 'telegram-capture-script.ts');
const layoutPath = path.join(root, 'app', 'layout.tsx');

const captureSource = fs.readFileSync(capturePath, 'utf8');
const layoutSource = fs.readFileSync(layoutPath, 'utf8');

const missing = REQUIRED_CAPTURE_MARKERS.filter((marker) => !captureSource.includes(marker));
if (missing.length) {
  console.error('telegram-capture-script.ts is missing required markers:');
  for (const marker of missing) console.error(`  - ${marker}`);
  process.exit(1);
}

const capturePos = layoutSource.indexOf('installTelegramCaptureScript');
const telegramSdkPos = layoutSource.indexOf('telegram-web-app.js');
if (capturePos < 0 || telegramSdkPos < 0 || capturePos > telegramSdkPos) {
  console.error('app/layout.tsx must call installTelegramCaptureScript() BEFORE telegram-web-app.js');
  process.exit(1);
}

console.log('check-capture-script: OK');
