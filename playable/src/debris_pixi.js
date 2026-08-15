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

// A rock may also carry its own colour (sim `tint`/`glow`), which the pillar's debris uses so it
// stays the pillar's gold instead of joining the sandstone mass.
//
// IT TAKES TWO PASSES, and the reason is arithmetic rather than taste. Pixi's tint is a MULTIPLY,
// so it can only ever darken: the rock sheets average 0x917e6a (145,126,106) and the pillar art
// averages 0xf8b820 (248,184,32), which is brighter in red and green than the source. No tint
// reaches it — the best a multiply can do is 145,126,32, an olive. So the tinted sprite is drawn
// a second time in ADD, and the pair together are what land on the pillar's colour. `glow` is
// that second pass; a rock with no glow costs a hidden sprite and nothing else.
export class DebrisRenderer {
  constructor(sim, { atlas, palette = PALETTE, size = 34 } = {}) {
    this.sim = sim;
    this.palette = palette;
    this.container = new PIXI.Container();
    // Two layers rather than interleaved sprites, so each stays one batched draw call and every
    // additive highlight lands over every rock body rather than under the next one along.
    this.base = new PIXI.Container();
    this.glowLayer = new PIXI.Container();
    this.container.addChild(this.base, this.glowLayer);
    this.sprites = [];
    this.glows = [];
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

    const make = (parent, blend) => this.sim.parts.map(() => {
      const s = new PIXI.Sprite(this.frames[0]);
      s.anchor.set(0.5);
      s.width = s.height = size;
      s.visible = false;
      if (blend) s.blendMode = blend;
      parent.addChild(s);
      return s;
    });

    this.base.removeChildren();
    this.glowLayer.removeChildren();
    this.sprites = make(this.base, null);
    this.glows = make(this.glowLayer, 'add');
  }

  sync() {
    if (!this.sprites.length) return;
    const parts = this.sim.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const s = this.sprites[i];
      const g = this.glows[i];
      if (!p.alive) { s.visible = false; g.visible = false; continue; }
      s.visible = true;
      s.x = p.x;
      s.y = p.y;
      s.rotation = p.drawAngle;
      s.tint = p.tint || this.palette[p.type % this.palette.length];
      const f = p.type * ROCK_FRAMES + p.frame;
      if (this.frames[f]) s.texture = this.frames[f];

      // The additive pass, for rocks that asked for one. Everything but the blend and the tint
      // is the base sprite's, so the highlight can never drift off the rock it belongs to.
      g.visible = !!p.glow;
      if (!p.glow) continue;
      g.x = s.x;
      g.y = s.y;
      g.rotation = s.rotation;
      g.texture = s.texture;
      g.tint = p.glow;
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
