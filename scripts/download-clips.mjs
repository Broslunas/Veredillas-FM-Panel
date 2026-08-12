// Descarga con yt-dlp los clips de YouTube pendientes en EpisodeContent.clips[]
// y genera una miniatura con ffmpeg. Reanudable via tmp/clips-download/manifest.json.
//
// Uso:
//   node --env-file=.env.local scripts/download-clips.mjs
//   node --env-file=.env.local scripts/download-clips.mjs --limit 3
//   node --env-file=.env.local scripts/download-clips.mjs --episode <slug>

import mongoose from 'mongoose';
import { spawn } from 'child_process';
import { mkdir, writeFile, readFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'tmp/clips-download');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/shorts\/([^?&]+)/,
  /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/,
  /youtu\.be\/([^?&]+)/,
  /youtube\.com\/embed\/([^?&]+)/,
];
const VALID_VIDEO_ID = /^[\w-]+$/;

function extractYouTubeId(url) {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function slugifySegment(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: null, episode: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
    if (args[i] === '--episode') opts.episode = args[++i];
  }
  return opts;
}

function run(command, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
      shell: process.platform === 'win32',
    });
    let stderr = '';
    if (quiet && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(quiet && stderr ? stderr.trim().slice(-500) : `${command} salió con código ${code}`));
    });
  });
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

async function saveManifest(manifest) {
  const tmpPath = `${MANIFEST_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
  await rename(tmpPath, MANIFEST_PATH); // atomic: a Ctrl+C mid-write can't corrupt manifest.json
}

const episodeContentSchema = new mongoose.Schema({}, { strict: false });

async function fetchPendingClips(episodeFilter, manifestByKey) {
  await mongoose.connect(process.env.MONGODB_URI);
  const EpisodeContent = mongoose.models.EpisodeContent || mongoose.model('EpisodeContent', episodeContentSchema);
  const query = episodeFilter ? { slug: episodeFilter } : {};
  const episodes = await EpisodeContent.find(query).lean();
  await mongoose.disconnect();

  const pending = [];
  for (const ep of episodes) {
    (ep.clips || []).forEach((clip, clipIndex) => {
      const videoId = clip.videoId || extractYouTubeId(clip.url);
      if (!videoId || !VALID_VIDEO_ID.test(videoId)) {
        console.warn(`Aviso: no se pudo extraer videoId de "${clip.title}" (${ep.slug}#${clipIndex}), se omite.`);
        return;
      }

      const key = `${ep.slug}#${clipIndex}`;
      const existing = manifestByKey.get(key);
      if (existing && (existing.status === 'downloaded' || existing.status === 'migrated')) return;

      pending.push({
        key,
        episodeId: String(ep._id),
        episodeSlug: ep.slug,
        clipIndex,
        title: clip.title,
        youtubeUrl: clip.url,
        videoId,
      });
    });
  }
  return pending;
}

async function downloadClip(item) {
  const baseName = `${slugifySegment(item.episodeSlug)}__${item.videoId}`;
  const videoPath = path.join(OUTPUT_DIR, `${baseName}.mp4`);
  const thumbPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);

  console.log(`\n-> Descargando "${item.title}" (${item.videoId})...`);
  await run('yt-dlp', [
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '-o', videoPath,
    `https://www.youtube.com/watch?v=${item.videoId}`,
  ]);

  console.log('-> Generando miniatura...');
  await run('ffmpeg', ['-y', '-ss', '00:00:01', '-i', videoPath, '-frames:v', '1', '-q:v', '3', thumbPath], { quiet: true });

  return { videoPath, thumbPath };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');

  const { limit, episode: episodeFilter } = parseArgs();

  await mkdir(OUTPUT_DIR, { recursive: true });
  let manifest = await loadManifest();
  const manifestByKey = new Map(manifest.map((entry) => [entry.key, entry]));

  let pending = await fetchPendingClips(episodeFilter, manifestByKey);
  if (limit) pending = pending.slice(0, limit);

  console.log(`Clips pendientes de descargar: ${pending.length}`);

  let ok = 0;
  const failures = [];

  for (const item of pending) {
    const entry = { ...item, status: 'pending' };
    try {
      const { videoPath, thumbPath } = await downloadClip(item);
      entry.localVideoPath = videoPath;
      entry.localThumbPath = thumbPath;
      entry.status = 'downloaded';
      ok += 1;
      console.log(`OK "${item.title}"`);
    } catch (error) {
      entry.status = 'error';
      entry.error = error.message;
      failures.push({ title: item.title, videoId: item.videoId, error: error.message });
      console.error(`Error con "${item.title}": ${error.message}`);
    }

    manifestByKey.set(item.key, entry);
    manifest = Array.from(manifestByKey.values());
    await saveManifest(manifest);
  }

  console.log(`\nDescarga completada: ${ok} ok, ${failures.length} con error.`);
  if (failures.length > 0) {
    console.log('Clips con error:');
    failures.forEach((f) => console.log(`  - ${f.title} (${f.videoId}): ${f.error}`));
  }
  console.log(`Manifiesto: ${MANIFEST_PATH}`);
  console.log('Siguiente paso: node --env-file=.env.local scripts/migrate-clips-to-r2.mjs');
}

main().catch((err) => {
  console.error('Error en la descarga:', err);
  process.exit(1);
});
