/**
 * Export promo animation to WebM/MP4.
 * Usage: node scripts/export-promo-video.mjs [6|10]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'docs', 'assets');
const durationSec = process.argv[2] === '6' ? 6 : 10;
const baseName = durationSec === 6 ? 'promo-6s' : 'promo-10s';
const htmlPath = path.join(root, 'public', 'promo-video.html');
const webmOut = path.join(assetsDir, `${baseName}.webm`);
const mp4Out = path.join(assetsDir, `${baseName}.mp4`);

function findFfmpeg() {
  const names = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg-win64.exe'] : ['ffmpeg'];
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
    path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'cursor-sandbox-cache'),
  ].filter(Boolean);

  for (const rootDir of roots) {
    if (!fs.existsSync(rootDir)) continue;
    if (rootDir.includes('cursor-sandbox-cache')) {
      for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const name of names) {
          const candidate = path.join(rootDir, entry.name, 'playwright', 'ffmpeg-1011', name);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      continue;
    }
    for (const name of names) {
      const candidate = path.join(rootDir, 'ffmpeg-1011', name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return 'ffmpeg';
}

if (!fs.existsSync(htmlPath)) {
  console.error('Missing public/promo-video.html');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const pageUrl = `http://127.0.0.1:${port}/?loop=0&duration=${durationSec}`;

console.log(`Recording ${durationSec}s promo from ${pageUrl}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: { dir: assetsDir, size: { width: 1080, height: 1920 } },
});

const page = await context.newPage();
await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(durationSec * 1000 + 500);

const video = page.video();
await page.close();
await context.close();
await browser.close();
server.close();

if (!video) {
  console.error('No video recorded');
  process.exit(1);
}

const tempPath = await video.path();
fs.copyFileSync(tempPath, webmOut);
console.log(`Saved ${webmOut}`);

const ffmpegBin = findFfmpeg();
const ffmpeg = spawnSync(
  ffmpegBin,
  ['-y', '-i', webmOut, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Out],
  { encoding: 'utf8' }
);

if (ffmpeg.status === 0) {
  console.log(`Saved ${mp4Out}`);
} else {
  console.log('MP4 conversion skipped — open .webm in Chrome or VLC');
  if (ffmpeg.stderr) console.log(ffmpeg.stderr.slice(0, 300));
}
