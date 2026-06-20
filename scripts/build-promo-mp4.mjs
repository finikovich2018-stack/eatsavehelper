/**
 * Build MP4 promo with Russian voiceover.
 * Usage: node scripts/build-promo-mp4.mjs [6|10]
 */
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const durationSec = process.argv[2] === '6' ? 6 : 10;
const baseName = durationSec === 6 ? 'promo-6s' : 'promo-10s';
const videoIn = path.join(root, 'docs', 'assets', `${baseName}.webm`);
const workDir = path.join(os.tmpdir(), 'eatsave-promo-build');
const desktopOut = path.join(os.homedir(), 'Desktop', 'EatSave-promo');
const mp4Out = path.join(desktopOut, `EatSave-${baseName}-ozvuchka.mp4`);

const VOICE = 'ru-RU-DmitryNeural';

const SCRIPT_10 = [
  { at: 0, text: 'EatSave — умный холодильник в Telegram.' },
  { at: 1.8, text: 'Сканируешь чек — продукты сами в холодильник.' },
  { at: 3.8, text: 'Напомнит, что скоро испортится.' },
  { at: 5.8, text: 'AI подскажет, что приготовить.' },
  { at: 7.8, text: 'Открой EatSavehelper bot в Telegram.' },
];

const SCRIPT_6 = [
  { at: 0, text: 'EatSave в Telegram.' },
  { at: 1.0, text: 'Сканируй чеки и следи за сроками.' },
  { at: 2.8, text: 'AI подскажет рецепт.' },
  { at: 4.2, text: 'EatSavehelper bot.' },
];

const SCRIPT = durationSec === 6 ? SCRIPT_6 : SCRIPT_10;

function ffmpegBin() {
  return 'ffmpeg';
}

async function synthSegment(index, text) {
  const out = path.join(workDir, `seg-${index}.mp3`);
  const tts = new EdgeTTS({
    voice: VOICE,
    lang: 'ru-RU',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: '+5%',
    timeout: 30000,
  });
  await tts.ttsPromise(text, out);
  return out;
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' }
  );
  return Number(r.stdout.trim()) || 0;
}

function buildAudioMix(segmentFiles) {
  const mixed = path.join(workDir, 'voiceover.mp3');
  const filters = [];
  const inputs = [];

  segmentFiles.forEach((file, i) => {
    const delayMs = Math.round(SCRIPT[i].at * 1000);
    inputs.push('-i', file);
    filters.push(`[${i}:a]adelay=${delayMs}|${delayMs},volume=1.2[a${i}]`);
  });

  const mixInputs = segmentFiles.map((_, i) => `[a${i}]`).join('');
  filters.push(`${mixInputs}amix=inputs=${segmentFiles.length}:duration=longest:dropout_transition=0[aout]`);

  const args = [
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[aout]',
    '-t',
    String(durationSec),
    mixed,
  ];

  const r = spawnSync(ffmpegBin(), args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error('Audio mix failed');
  }
  return mixed;
}

function muxVideoAudio(audioFile) {
  fs.mkdirSync(desktopOut, { recursive: true });
  const args = [
    '-y',
    '-i',
    videoIn,
    '-i',
    audioFile,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-shortest',
    mp4Out,
  ];
  const r = spawnSync(ffmpegBin(), args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error('MP4 mux failed');
  }
}

if (!fs.existsSync(videoIn)) {
  console.error(`Missing ${videoIn}. Run: npm run promo:export`);
  process.exit(1);
}

fs.mkdirSync(workDir, { recursive: true });

console.log(`Generating voiceover (${durationSec}s, ${VOICE})...`);
const segmentFiles = [];
for (let i = 0; i < SCRIPT.length; i++) {
  console.log(`  [${i + 1}/${SCRIPT.length}] ${SCRIPT[i].text}`);
  const file = await synthSegment(i, SCRIPT[i].text);
  segmentFiles.push(file);
  console.log(`       ${probeDuration(file).toFixed(1)}s`);
}

console.log('Mixing audio...');
const audioFile = buildAudioMix(segmentFiles);

console.log('Creating MP4...');
muxVideoAudio(audioFile);

console.log(`Done: ${mp4Out}`);
process.exit(0);
