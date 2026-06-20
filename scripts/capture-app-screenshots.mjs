import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const outDir = path.join(os.homedir(), 'Desktop', 'EatSave-fotki');
const baseUrl = process.env.PROMO_BASE_URL || 'http://127.0.0.1:3000';
const pages = [
  { name: 'home', path: '/marketing/home' },
  { name: 'fridge', path: '/marketing/fridge' },
  { name: 'scan', path: '/marketing/scan' },
  { name: 'recipes', path: '/marketing/recipes' },
  { name: 'budget', path: '/marketing/budget' },
  { name: 'profile', path: '/marketing/profile' },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await context.newPage();

for (const { name, path: route } of pages) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const file = path.join(outDir, `app-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('Saved', file);
}

await browser.close();
