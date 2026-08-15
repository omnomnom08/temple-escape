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

// vfx/ was a scratch folder of effect art, most of it never shipped, so it is listed rather than
// walked — the same rule layers.js applies to the PSD extract: the bundle is a function of what is
// used, not what exists. The unused art has since been deleted; the list is what kept it honest.
const VFX_SHIP = ['sparkle2.png', 'rope.png', 'vfx_smoke.png'];

// layers/ gets the same treatment, and for the same reason. The extract holds every layer of
// the document; only these have a matching import in src/layers.js, and walking the folder
// instead wrote a .webp next to each of the others — orphan derivatives that nothing loads and
// that come straight back the moment this is run. Keep this list in step with layers.js: an
// import added there without a name here silently keeps serving a stale .webp.
//
// ui_btn_sound_on/off are deliberately absent. They ship as .png — at 50x50 they encode BIGGER
// as WebP (1542 vs 1429, 1104 vs 1010), so transcoding them is a loss, not a saving.
const LAYERS_SHIP = [
  'bg', 'top_walls', 'top_walls_ceilling', 'spikes', 'spikes_body_back', 'spikes_body_top',
  'spikes_mask', 'pillar', 'hero_placeholder', 'plate_single', 'gem_blue_teardrop',
  'gem_green_square', 'gem_red_heart', 'plate_particle_0', 'plate_particle_1', 'plate_particle_2',
  'progressbar', 'arm_icon', 'ui_screen_shadow', 'error', 'text_back', 'MERGE_TO_SAVE_HIM',
  'HURRY_UP', 'btn', 'btn_1', 'DOWNLOAD', 'cursor', 'chest_closed', 'ui_endcard_ray',
  'ui_endcard_ray_glow_2', 'ui_endcard_ray_glow_copy_3', 'OPEN', 'WIN', 'FAIL', 'TRY_AGAIN',
].map((n) => `${n}.png`);

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

// Per-file alpha quality, where the default 90 is the wrong trade. WebP encodes alpha as its own
// plane, and 90 is near-lossless: fine for cut-out art, ruinous for a layer that IS its alpha.
//
// `error` is the panic vignette — one flat colour (233,0,1) over a smooth full-frame alpha ramp,
// so the alpha plane is the entire file. At 90 it is 276 KB; at 70 it is 39 KB, and the ramp
// deviates from the source by 3.8/255 on average, 9 at worst, with 0.5% of pixels more than 8
// off. On a gradient drawn at partial opacity that is invisible, and 237 KB is a seventh of the
// bundle's whole art budget. The cliff is between 70 and 80 — 80 is already 209 KB.
//
// The endcard's three ray layers are the same shape of file for the same reason: a starburst and
// two broad glows, all of them soft ramps that ARE their alpha, and all three drawn blended (two
// of them additively) rather than as cut-outs. Together they were 172 KB, the largest block of
// art in the bundle after the backdrop; at 70 they are 77 KB, with the alpha off by 2/255 on
// average and 9 at worst — inside the tolerance already accepted for `error` above.
const ALPHA_Q = {
  error: 70,
  ui_endcard_ray: 70,
  ui_endcard_ray_glow_2: 70,
  ui_endcard_ray_glow_copy_3: 70,
};
const ALPHA_Q_DEFAULT = 90;

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
    .webp({ quality: QUALITY, effort: 6, alphaQuality: ALPHA_Q[name] ?? ALPHA_Q_DEFAULT })
    .toFile(out);

  const after = fs.statSync(out).size;
  return { name, before, after, from: meta.width, to: target };
}

async function run() {
  const jobs = [];
  for (const f of fs.readdirSync(ART)) {
    if (f.toLowerCase().endsWith('.png')) jobs.push([f, ART, MAX_W[f.replace(/\.png$/i, '')]]);
  }
  for (const f of LAYERS_SHIP) {
    // No MAX_W lookup: layer art is already exported at document scale, and the walk this
    // replaced passed no cap either — reading one here would quietly re-encode bg at a new size.
    if (fs.existsSync(path.join(LAYERS, f))) jobs.push([f, LAYERS, undefined]);
    else console.warn(`  missing layers/${f} — listed in LAYERS_SHIP`);
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
