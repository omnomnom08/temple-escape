import * as PIXI from 'pixi.js';
import { ROCK_FRAMES, ROCK_TYPES } from './debris_sim.js';

// Thin Pixi renderer for DebrisSim. All rocks share one base texture (the composed
// atlas), so Pixi batches them into a single draw call — the same win the InstancedMesh
// gave us in 3D, for less code.
//
// The art is greyscale; colour comes from sprite.tint, which is exactly the
// _BaseGrey/_TintColor pipeline the reference uses, and free in Pixi.

// Tint is applied on top of the authored art, so these stay close to white. The rock sheets
// are painted and lit already — the strong greyscale-plus-tint palette this started with was
// built for unpainted art and multiplied these down to near-black. Shape variety comes from
// the four separate sheets; the tint only breaks up uniformity across the mass.
const PALETTE = [0xffffff, 0xf3e7d9, 0xe6d6c2, 0xd2c2ae];

export class DebrisRenderer {
  constructor(sim, { atlas, palette = PALETTE, size = 34 } = {}) {
    this.sim = sim;
    this.palette = palette;
    this.container = new PIXI.Container();
    this.sprites = [];
    this.frames = [];

    if (atlas) this.setAtlas(atlas, size);
  }

  // atlas = { image, cell } from art.loadRockAtlas()
  setAtlas(atlas, size) {
    const source = PIXI.Texture.from(atlas.image).source;
    this.frames = [];
    for (let t = 0; t < ROCK_TYPES; t++)
      for (let f = 0; f < ROCK_FRAMES; f++) {
        this.frames.push(new PIXI.Texture({
          source,
          frame: new PIXI.Rectangle(f * atlas.cell, t * atlas.cell, atlas.cell, atlas.cell),
        }));
      }

    this.container.removeChildren();
    this.sprites = this.sim.parts.map(() => {
      const s = new PIXI.Sprite(this.frames[0]);
      s.anchor.set(0.5);
      s.width = s.height = size;
      s.visible = false;
      this.container.addChild(s);
      return s;
    });
  }

  sync() {
    if (!this.sprites.length) return;
    const parts = this.sim.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const s = this.sprites[i];
      if (!p.alive) { s.visible = false; continue; }
      s.visible = true;
      s.x = p.x;
      s.y = p.y;
      s.rotation = p.drawAngle;
      s.tint = this.palette[p.type % this.palette.length];
      const f = p.type * ROCK_FRAMES + p.frame;
      if (this.frames[f]) s.texture = this.frames[f];
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
