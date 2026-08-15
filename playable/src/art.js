import { ROCK_FRAMES, ROCK_TYPES } from './debris_sim.js';

// Loose art that is not a PSD layer: the rubble sheets and the character rig.
// Everything composed from the layout PSD goes through layers.js instead.
//
// The globs are narrow on purpose. `import.meta.glob` with `eager: true` bundles every file
// it matches, whether or not the result is ever read — a wide '*.{png,webp}' here quietly
// inlined the 3 MB source PNG of the backdrop plus both copies of every rock sheet, and no
// amount of filtering afterwards removes them from the build.

// rock01_spritesheet.webp ... rock04_spritesheet.webp — one strip per rock type.
const rockFiles = import.meta.glob('../../assets/art/rock*_spritesheet.webp', {
  eager: true, query: '?url', import: 'default',
});

// The character rig, as a URL rather than an image — Three's loader does its own fetching.
// Resolves to null until a hero GLB exists, which is what keeps the 2D explorer in play.
//
// Rooted at assets/art/ and not a directory higher. There is a `world.glb` under
// assets/source/ that this build has no use for, and a glob that reached it would inline it
// into the bundle regardless — `eager: true` does not care whether anything reads the result.
const modelFiles = import.meta.glob('../../assets/art/**/*.glb', {
  eager: true, query: '?url', import: 'default',
});

// The rig's palette atlas, shipped beside the GLB rather than inside it. The same 512x512
// image embedded as PNG cost 163 KB against 9 KB here, so the export writes no textures and
// hero3d assigns this one instead.
const modelTextures = import.meta.glob('../../assets/art/3d/*.webp', {
  eager: true, query: '?url', import: 'default',
});

const byStem = (files, name) => {
  const key = Object.keys(files).find((k) => k.split('/').pop().split('.')[0] === name);
  return key ? files[key] : null;
};

export function modelURL(name) {
  return byStem(modelFiles, name);
}

export function modelTextureURL(name) {
  return byStem(modelTextures, name);
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn(`[art] could not decode ${url}`); resolve(null); };
    img.src = url;
  });
}

// The rubble is authored as one sheet per rock type, each a strip of ROCK_FRAMES square
// tumble frames. The renderer needs them as ONE texture, because a single shared texture is
// what lets Pixi batch the whole 200-400 rock mass into a single draw call. So they are
// composed onto a canvas once at boot into the ROCK_FRAMES x ROCK_TYPES grid that
// debris_pixi.js indexes into.
//
// Returns null when no sheets are present, and the renderer falls back to flat shapes.
export async function loadRockAtlas() {
  const keys = Object.keys(rockFiles).sort(); // rock01, rock02, ... — sheet order = row order
  if (!keys.length) return null;

  const sheets = (await Promise.all(keys.map((k) => loadImage(rockFiles[k])))).filter(Boolean);
  if (!sheets.length) return null;

  const cell = sheets[0].height; // frames are square, so the strip height is the cell size
  const canvas = document.createElement('canvas');
  canvas.width = ROCK_FRAMES * cell;
  canvas.height = ROCK_TYPES * cell;
  const ctx = canvas.getContext('2d');
  sheets.slice(0, ROCK_TYPES).forEach((img, row) => ctx.drawImage(img, 0, row * cell));

  if (sheets.length !== ROCK_TYPES) {
    console.warn(`[art] found ${sheets.length} rock sheets, expected ${ROCK_TYPES} — ` +
      'missing rows will render as blank rocks');
  }
  return { image: canvas, cell, cols: ROCK_FRAMES, rows: ROCK_TYPES };
}
