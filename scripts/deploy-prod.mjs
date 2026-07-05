#!/usr/bin/env node
/**
 * Production deploy for EatSave Mini App (Telegram bot URL).
 * Always links the correct Vercel project before deploying.
 *
 * Usage: npm run deploy
 * Do NOT use raw `npx vercel --prod` — account has duplicate projects.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command) {
  execSync(command, { cwd: root, stdio: 'inherit' });
}

console.log('Running deploy pre-checks…');
run('node scripts/check-deploy-target.mjs');

const config = JSON.parse(fs.readFileSync(path.join(root, 'deploy.config.json'), 'utf8'));
const { vercelProject, productionUrl } = config;

const projectJsonPath = path.join(root, '.vercel', 'project.json');
let linkedName = null;
if (fs.existsSync(projectJsonPath)) {
  linkedName = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8')).projectName;
}

if (linkedName !== vercelProject) {
  console.log(`Linking Vercel project "${vercelProject}"…`);
  run(`npx vercel link --project ${vercelProject} --yes`);
}

run('node scripts/check-deploy-target.mjs');

console.log(`\nDeploying to ${vercelProject} → ${productionUrl}\n`);
run('npx vercel --prod --yes');

try {
  const res = await fetch(`${productionUrl}/api/setup`);
  if (res.ok) {
    console.log(`\nPost-deploy check: ${productionUrl}/api/setup → ${res.status}`);
  } else {
    console.warn(`\nPost-deploy warning: /api/setup returned ${res.status}`);
  }
} catch (error) {
  console.warn('\nPost-deploy check skipped:', error.message);
}

console.log(`\nDone. Mini App: ${productionUrl}/home`);
