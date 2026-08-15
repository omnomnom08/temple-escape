import manifest from '../../assets/art/layers/manifest.json';

// Registry of the PSD layers this game actually ships.
//
// The imports are explicit rather than an import.meta.glob, and that is deliberate: the
// extractor produces 81 layers totalling 13 MB, and a glob would inline every one of them
// into the single-file build. Listing them by hand is the only way the bundle stays a
// function of what is used rather than what exists.
//
// They point at .webp, which is generated from the extracted .png by `npm run art`. The
// PNGs remain the source of truth on disk; only the shipped form is compressed. Swapping
// this back to .png is a find-and-replace if the encoding ever needs redoing.
//
// Placement comes from manifest.json - the same file the extractor wrote - so document
// coordinates are never retyped here and cannot drift from the PSD.

import bgUrl from '../../assets/art/bg.webp?url';

// Not a PSD layer, so it has no manifest entry and cannot go through layer() — effect art is
// placed by the code that spawns it, not by the document.
import sparkleUrl from '../../assets/art/vfx/sparkle2.webp?url';

// Confetti scraps. Stay .png for the same reason vfx_star did — at 42x49 and ~750 bytes each
// they come out BIGGER as WebP (see the note in tools/optimize-art.mjs). 2.3 KB for all three.
import conf0Url from '../../assets/art/vfx/part_eff_0.png?url';
import conf1Url from '../../assets/art/vfx/part_eff_1.png?url';
import conf2Url from '../../assets/art/vfx/part_eff_2.png?url';

import wallUrl from '../../assets/art/layers/wall.webp?url';
import shadowUrl from '../../assets/art/layers/shadow.webp?url';
import spikesUrl from '../../assets/art/layers/spikes.webp?url';
import pillarUrl from '../../assets/art/layers/pillar.webp?url';
import doorUrl from '../../assets/art/layers/door_original_exact.webp?url';
import doorShadowUrl from '../../assets/art/layers/shadow__2.webp?url';
import stepStoneUrl from '../../assets/art/layers/step_stone.webp?url';
import heroUrl from '../../assets/art/layers/hero_placeholder.webp?url';

import plateUrl from '../../assets/art/layers/plate_single.webp?url';
import gemBlueUrl from '../../assets/art/layers/gem_blue_teardrop.webp?url';
import gemGreenUrl from '../../assets/art/layers/gem_green_square.webp?url';
import gemRedUrl from '../../assets/art/layers/gem_red_heart.webp?url';
// gem_orange_diamond.webp is deliberately NOT imported — the board plays on three colours, and
// an eager import here would bundle the file whether or not anything ever draws it.

import particle0Url from '../../assets/art/layers/plate_particle_0.webp?url';
import particle1Url from '../../assets/art/layers/plate_particle_1.webp?url';
import particle2Url from '../../assets/art/layers/plate_particle_2.webp?url';

import progressbarUrl from '../../assets/art/layers/progressbar.webp?url';
import armIconUrl from '../../assets/art/layers/arm_icon.webp?url';
import textBackUrl from '../../assets/art/layers/text_back.webp?url';
import titleUrl from '../../assets/art/layers/MERGE_TO_SAVE_HIM.webp?url';
import hurryUrl from '../../assets/art/layers/HURRY_UP.webp?url';
// The one green button, exported at the size the WIN CARD places it (458x178) so that the
// smaller CTA is a downscale rather than a blur.
//
// The PSD has two layers both literally named `btn` — the CTA at 197x78 and the win card's at
// 458x178 — and both are instances of the same embedded smart object (`Ellipse 567.psb`,
// 463x185 native). An earlier extract invented a second name, `btn_0`, for the collision; that
// file is gone and its manifest entry matches nothing. See WIN_BTN_BOX in game.js for where
// the win card's placement now comes from.
import btnUrl from '../../assets/art/layers/btn.webp?url';
import ctaTextUrl from '../../assets/art/layers/DOWNLOAD.webp?url';
import cursorUrl from '../../assets/art/layers/cursor.webp?url';

// The chest is a still, lured by a tween rather than a sprite sheet. The sheet was 118 KB of
// WebP — ~157 KB once inlined — against 26 KB here, and a scale-and-hop in code covers what it
// was doing. See chest.js.
import chestUrl from '../../assets/art/layers/chest_closed.webp?url';
// Three layers make the light behind the chest, not one — the fine white starburst plus two
// broad glows under it. The PSD has the cyan one on LINEAR DODGE (add) and the warm one on
// normal; game.js sets the blend to match, because compositing an additive layer normally is
// what turned the halo grey.
import rayUrl from '../../assets/art/layers/ui_endcard_ray.webp?url';
import glowAddUrl from '../../assets/art/layers/ui_endcard_ray_glow_2.webp?url';
import glowWarmUrl from '../../assets/art/layers/ui_endcard_ray_glow_copy_3.webp?url';
// The win button reads OPEN, not NEXT LEVEL — that layer no longer exists in the PSD and its
// export has been deleted. Recovered from the document composite; see OPEN_BOX in game.js for
// why its placement is not a manifest lookup.
import winTextUrl from '../../assets/art/layers/OPEN.webp?url';
import winTitleUrl from '../../assets/art/layers/WIN.webp?url';
import failTitleUrl from '../../assets/art/layers/FAIL.webp?url';
import failBtnUrl from '../../assets/art/layers/btn_1.webp?url';
import failTextUrl from '../../assets/art/layers/TRY_AGAIN.webp?url';

const URLS = {
  wall: wallUrl,
  shadow: shadowUrl,
  spikes: spikesUrl,
  pillar: pillarUrl,
  door_original_exact: doorUrl,
  shadow__2: doorShadowUrl,
  step_stone: stepStoneUrl,
  hero_placeholder: heroUrl,
  plate_single: plateUrl,
  gem_blue_teardrop: gemBlueUrl,
  gem_green_square: gemGreenUrl,
  gem_red_heart: gemRedUrl,
  plate_particle_0: particle0Url,
  plate_particle_1: particle1Url,
  plate_particle_2: particle2Url,
  progressbar: progressbarUrl,
  arm_icon: armIconUrl,
  text_back: textBackUrl,
  MERGE_TO_SAVE_HIM: titleUrl,
  HURRY_UP: hurryUrl,
  btn: btnUrl,
  DOWNLOAD: ctaTextUrl,
  cursor: cursorUrl,
  ui_endcard_ray: rayUrl,
  ui_endcard_ray_glow_2: glowAddUrl,
  ui_endcard_ray_glow_copy_3: glowWarmUrl,
  OPEN: winTextUrl,
  chest_closed: chestUrl,
  WIN: winTitleUrl,
  FAIL: failTitleUrl,
  btn_1: failBtnUrl,
  TRY_AGAIN: failTextUrl,
};

export const BG_URL = bgUrl;
export const VFX_SPARKLE_URL = sparkleUrl;
export const CONFETTI_URLS = [conf0Url, conf1Url, conf2Url];
export const DOC = manifest.document; // { width: 1280, height: 1280 }

// manifest entries keyed by basename, which is what URLS is keyed on too
const byName = new Map();
for (const l of manifest.layers) byName.set(l.file.replace(/\.png$/, ''), l);

// Placement WITHOUT art: { x, y, width, height, opacity } in document space, or null if the
// PSD has no such layer. Every layer in the extract has a box, whether or not its pixels ship.
//
// This is what lets one texture serve two boxes. The CTA button is `btn`'s geometry wearing
// `btn_0`'s pixels, so the PSD still decides where the button sits and how big it is — the
// document stays the single source of placement — while only one of the two images ships.
export function box(name) {
  const meta = byName.get(name);
  if (!meta) {
    console.warn(`[layers] "${name}" is not in the PSD extract`);
    return null;
  }
  return { x: meta.x, y: meta.y, width: meta.width, height: meta.height, opacity: meta.opacity };
}

// Just the art, with no opinion about placement. The counterpart to box(): layer() insists on
// BOTH and returns null if either is missing, which is wrong for anything whose position does
// not come from the manifest — OPEN ships but has no manifest entry, so layer('OPEN') is null
// and asking it for a URL silently drew nothing.
export function url(name) {
  const u = URLS[name];
  if (!u) {
    console.warn(`[layers] "${name}" has no shipped art`);
    return null;
  }
  return u;
}

// { url, x, y, width, height, opacity } in document space, or null if not shipped.
export function layer(name) {
  const url = URLS[name];
  const meta = byName.get(name);
  if (!url || !meta) {
    console.warn(`[layers] "${name}" is not in the shipped set`);
    return null;
  }
  return { url, x: meta.x, y: meta.y, width: meta.width, height: meta.height, opacity: meta.opacity };
}

// Centre of a layer in document space - most placements want this rather than the corner.
export function centerOf(name) {
  const l = layer(name);
  return l ? { x: l.x + l.width / 2, y: l.y + l.height / 2 } : null;
}
