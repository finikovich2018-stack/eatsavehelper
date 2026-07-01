/**
 * Capture tutorial video with production build (CSS loads correctly).
 * Usage:
 *   npm run build
 *   npm run start
 *   node scripts/capture-tutorial.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const baseUrl = process.env.TUTORIAL_BASE_URL || 'http://localhost:3000';
const framesDir = path.join(root, 'public', 'videos', 'frames');
const outFile = path.join(root, 'public', 'videos', 'eatsave-manual-add-ru.mp4');
const gifFile = path.join(root, 'public', 'videos', 'eatsave-manual-add-ru.gif');
const desktopCopy = path.join(process.env.USERPROFILE || '', 'Desktop', 'EatSave-manual-add-ru.mp4');
const desktopGif = path.join(process.env.USERPROFILE || '', 'Desktop', 'EatSave-manual-add-ru.gif');

fs.mkdirSync(framesDir, { recursive: true });

const puppeteer = await import('puppeteer').then((m) => m.default).catch(() => null);
if (!puppeteer) {
  console.error('Run: npm install -D puppeteer');
  process.exit(1);
}

async function waitForStyles(page) {
  await page.waitForSelector('.text-accent, img[src="/eatsave-logo.png"]', { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 800));
}

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 430, height: 844, deviceScaleFactor: 2 },
});
const page = await browser.newPage();

for (let step = 1; step <= 5; step += 1) {
  const url = `${baseUrl}/tutorial-manual?step=${step}`;
  console.log('Capture', url);
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await waitForStyles(page);
  const out = path.join(framesDir, `step-${String(step).padStart(2, '0')}.png`);
  await page.screenshot({ path: out, fullPage: false });
}

await browser.close();

const concatPath = path.join(framesDir, 'concat.txt');
const lines = [];
for (let step = 1; step <= 5; step += 1) {
  const file = `step-${String(step).padStart(2, '0')}.png`;
  lines.push(`file '${file}'`, `duration ${step >= 4 ? 5 : 4}`);
}
lines.push(`file 'step-05.png'`);
fs.writeFileSync(concatPath, lines.join('\n'));

const ffmpeg = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'concat.txt',
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0c0f0c,format=yuv420p',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    outFile,
  ],
  { cwd: framesDir, stdio: 'inherit' }
);

if (ffmpeg.status !== 0) process.exit(ffmpeg.status ?? 1);

const gif = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loop',
    '1',
    '-t',
    '4',
    '-i',
    'step-01.png',
    '-loop',
    '1',
    '-t',
    '4',
    '-i',
    'step-02.png',
    '-loop',
    '1',
    '-t',
    '4',
    '-i',
    'step-03.png',
    '-loop',
    '1',
    '-t',
    '5',
    '-i',
    'step-04.png',
    '-loop',
    '1',
    '-t',
    '5',
    '-i',
    'step-05.png',
    '-filter_complex',
    '[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2:color=0x0c0f0c,fps=8,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
    '-loop',
    '0',
    gifFile,
  ],
  { cwd: framesDir, stdio: 'inherit' }
);

if (gif.status !== 0) process.exit(gif.status ?? 1);

fs.copyFileSync(outFile, desktopCopy);
fs.copyFileSync(gifFile, desktopGif);
console.log('Video:', outFile);
console.log('GIF:', gifFile);
console.log('Desktop:', desktopCopy);
console.log('Desktop GIF:', desktopGif);
