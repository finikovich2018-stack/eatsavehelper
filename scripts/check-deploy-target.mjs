#!/usr/bin/env node
/**
 * Ensures deploy targets the Telegram bot production project, not a duplicate Vercel app.
 * Safe to run in CI (no .vercel link required).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'deploy.config.json');

function fail(message) {
  console.error(`check:deploy — ${message}`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  fail('missing deploy.config.json');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { vercelProject, productionUrl, forbiddenProjects = [], vercelignoreRequired = [] } = config;

if (!vercelProject || !productionUrl) {
  fail('deploy.config.json must define vercelProject and productionUrl');
}

const vercelignorePath = path.join(root, '.vercelignore');
if (!fs.existsSync(vercelignorePath)) {
  fail('missing .vercelignore (large docs/ assets break CLI deploys)');
}

const vercelignore = fs.readFileSync(vercelignorePath, 'utf8');
for (const line of vercelignoreRequired) {
  if (!vercelignore.includes(line)) {
    fail(`.vercelignore must include "${line}"`);
  }
}

const appUrlPath = path.join(root, 'lib', 'app-url.ts');
const appUrlSource = fs.readFileSync(appUrlPath, 'utf8');
const host = productionUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!appUrlSource.includes(host)) {
  fail(`lib/app-url.ts production fallback must include ${host}`);
}

const envExamplePath = path.join(root, '.env.local.example');
if (fs.existsSync(envExamplePath)) {
  const example = fs.readFileSync(envExamplePath, 'utf8');
  if (!example.includes(host) && !example.includes('eatsavehelper-m6hl')) {
    fail('.env.local.example should reference the production host');
  }
}

const projectJsonPath = path.join(root, '.vercel', 'project.json');
if (fs.existsSync(projectJsonPath)) {
  const linked = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  if (linked.projectName !== vercelProject) {
    fail(
      `linked Vercel project is "${linked.projectName}", expected "${vercelProject}". ` +
        `Run: npm run deploy (or npx vercel link --project ${vercelProject} --yes)`
    );
  }
  if (forbiddenProjects.includes(linked.projectName)) {
    fail(`linked project "${linked.projectName}" is forbidden`);
  }
}

const envLocalPath = path.join(root, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envText = fs.readFileSync(envLocalPath, 'utf8');
  const match = envText.match(/^NEXT_PUBLIC_APP_URL=(.+)$/m);
  if (match) {
    const url = match[1].trim().replace(/\/$/, '').replace(/\/home$/, '');
    const expected = productionUrl.replace(/\/$/, '');
    if (url !== expected) {
      fail(`NEXT_PUBLIC_APP_URL is "${url}", expected "${expected}"`);
    }
  }
}

console.log(`check:deploy OK — production: ${productionUrl} (project: ${vercelProject})`);
