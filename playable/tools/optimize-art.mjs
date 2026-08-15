// Transcodes the shipped art to WebP at display resolution.
//
// Build-time only — sharp is a devDependency and nothing in src/ imports this. Run it after
// any art change:  npm run art
//
// Two things matter for a single-file playable. First, format: PNG base64-inlines at +33%
// and does not re-gzip, so a 3 MB PNG costs ~4 MB of bundle. Second, resolution: art authored
// at print-ish sizes is wasted on a sprite drawn 47 px wide. Both are handled here so src/
// can stay unaware of it.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ART = path.resolve(import.meta.dirname, '../../assets/art');
const LAYERS = path.join(ART, 'layers');
const VFX = path.join(ART, 'vfx');

// vfx/ is a scratch folder of effect art, most of which is not shipped (the 4x4 smoke grid
// alone is 326 KB), so it is listed rather than walked — the same rule layers.js applies to
// the PSD extract: the bundle is a function of what is used, not what exists.
const VFX_SHIP = ['sparkle2.png'];

// name -> max width in document units it is ever drawn at. Everything is emitted at 2x that
// for retina, capped at the source size — upscaling would only add bytes.
const MAX_W = {
  bg: 1280,
  rock01_spritesheet: 13 * 56, rock02_spritesheet: 13 * 56,
  rock03_spritesheet: 13 * 56, rock04_spritesheet: 13 * 56,
  // Authored at 256px for a hero-sized sparkle and drawn here at a fraction of a 63px cell.
  // 2x of 32 keeps the thin rays from turning to mush without carrying 256px of mostly-empty
  // alpha into the bundle.
  sparkle2: 32,
};

const QUALITY = 82;

async function convert(file, outDir, maxDocW) {
  const src = path.join(outDir, file);
  const name = file.replace(/\.png$/i, '');
  const img = sharp(src);
  const meta = await img.metadata();

  const target = maxDocW ? Math.min(meta.width, Math.round(maxDocW * 2)) : meta.width;
  const before = fs.statSync(src).size;

  const out = path.join(outDir, `${name}.webp`);
  await img
    .resize(target === meta.width ? undefined : { width: target })
    .webp({ quality: QUALITY, effort: 6, alphaQuality: 90 })
    .toFile(out);

  const after = fs.statSync(out).size;
  return { name, before, after, from: meta.width, to: target };
}

async function run() {
  const jobs = [];
  for (const f of fs.readdirSync(ART)) {
    if (f.toLowerCase().endsWith('.png')) jobs.push([f, ART, MAX_W[f.replace(/\.png$/i, '')]]);
  }
  if (fs.existsSync(LAYERS)) {
    for (const f of fs.readdirSync(LAYERS)) {
      if (f.toLowerCase().endsWith('.png')) jobs.push([f, LAYERS, undefined]);
    }
  }
  for (const f of VFX_SHIP) {
    if (fs.existsSync(path.join(VFX, f))) jobs.push([f, VFX, MAX_W[f.replace(/\.png$/i, '')]]);
    else console.warn(`  missing vfx/${f} — listed in VFX_SHIP`);
  }

  let before = 0, after = 0;
  const rows = [];
  for (const [f, dir, maxW] of jobs) {
    try {
      const r = await convert(f, dir, maxW);
      before += r.before; after += r.after;
      rows.push(r);
    } catch (e) {
      console.warn(`  skip ${f}: ${e.message}`);
    }
  }

  rows.sort((a, b) => (b.before - b.after) - (a.before - a.after));
  console.log('biggest savings:');
  for (const r of rows.slice(0, 10)) {
    const px = r.from === r.to ? `${r.from}px` : `${r.from}->${r.to}px`;
    console.log(`  ${r.name.padEnd(28)} ${(r.before / 1024).toFixed(0).padStart(6)} KB -> ${(r.after / 1024).toFixed(0).padStart(5)} KB  (${px})`);
  }
  console.log(`\n${rows.length} files: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB ` +
    `(${(100 * (1 - after / before)).toFixed(0)}% smaller)`);
}

run();
