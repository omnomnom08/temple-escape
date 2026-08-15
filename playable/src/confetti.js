// Confetti thrown in from both sides when the win card opens.
//
// Three painted scraps — orange, cream and gold — at 42x49 and about 750 bytes each, so the
// whole burst costs 2.3 KB. They share no atlas but there are only three textures, so Pixi
// batches the lot into three draw calls at worst.
//
// Hand-integrated rather than tweened, unlike the rest of the card. A tween interpolates toward
// a destination, and the whole character of confetti is that it has none: it is thrown, drag
// eats the throw, gravity takes over, and where a piece lands is whatever falls out of that. It
// is also the one effect here with per-frame state — the flutter — so it wants a tick anyway.
import * as PIXI from 'pixi.js';
import { CONFETTI_URLS } from './layers.js';

// Pieces per side.
const PER_SIDE = 24;

// Launch. Steep and mostly upward: these are side cannons firing a fountain up the edges of
// the card, not a throw across it.
const SPEED_MIN = 700;
const SPEED_VAR = 380;
// Radians off horizontal, upward — 46 to 77 degrees. Shallow angles are what sent pieces
// sailing into the middle, so the range starts well above the horizontal.
const ANGLE_MIN = 0.80;
const ANGLE_VAR = 0.55;

const GRAVITY = 1050;   // px/s²

// Per second, horizontal only — air stops the throw, not the fall.
//
// THIS is what decides where the confetti ends up sideways, more than the launch point does.
// Drag makes horizontal travel converge on vx/DRAG, so at the old 0.62 a piece drifted ~970 px
// inward: launched from +330 it crossed the whole card and settled on the FAR side, which is
// why the burst bunched in the middle. At 3.2 the travel is 48-235 px, so pieces stay in the
// outer band between the edge and about a third of the way in.
const DRAG = 3.2;
const SPIN_MIN = 3;     // rad/s
const SPIN_VAR = 7;

// Flutter: the piece is a flat rectangle turning over in the air, so its apparent width
// oscillates. Cheaper and more convincing than rotating a real quad in 3D.
const FLUTTER_MIN = 6;  // rad/s
const FLUTTER_VAR = 8;

const LIFE = 2.6;
const FADE = 0.7;       // seconds of fade at the end of a piece's life

// Drawn width, in design px. The art is 42 px across, so every piece is a downscale.
const W_MIN = 16;
const W_VAR = 12;

export class Confetti {
  // originX: how far out to each side the pieces come from; spanY: the vertical band they
  // launch across. Both in the parent's space, with the card centred on the origin.
  constructor({ parent, originX, spanY }) {
    this.originX = originX;
    this.spanY = spanY;
    this.pieces = [];
    this.pool = [];
    this.textures = null;
    this.layer = new PIXI.Container();
    parent.addChild(this.layer);
  }

  // Fail-soft, like the rest of the art path.
  async load() {
    await PIXI.Assets.load(CONFETTI_URLS);
    this.textures = CONFETTI_URLS.map((u) => PIXI.Texture.from(u));
  }

  burst() {
    if (!this.textures) return;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < PER_SIDE; i++) this._one(side);
    }
  }

  _one(side) {
    const s = this.pool.pop() ?? this._create();
    const tex = this.textures[(Math.random() * this.textures.length) | 0];
    s.texture = tex;
    s.visible = true;
    s.alpha = 1;

    // Aspect preserved from the art rather than randomised — these are painted scraps with a
    // shape, not generic rectangles.
    const w = W_MIN + Math.random() * W_VAR;
    s.width = w;
    s.height = w * (tex.height / tex.width);
    s.rotation = Math.random() * Math.PI;
    s.x = this.originX * side;
    s.y = (Math.random() - 0.5) * this.spanY;

    const speed = SPEED_MIN + Math.random() * SPEED_VAR;
    const ang = ANGLE_MIN + Math.random() * ANGLE_VAR;

    this.pieces.push({
      s,
      w,
      // Inward: a piece from the left travels right.
      vx: Math.cos(ang) * speed * -side,
      vy: -Math.sin(ang) * speed,
      spin: (SPIN_MIN + Math.random() * SPIN_VAR) * (Math.random() < 0.5 ? -1 : 1),
      flutter: FLUTTER_MIN + Math.random() * FLUTTER_VAR,
      phase: Math.random() * Math.PI * 2,
      t: 0,
    });
  }

  _create() {
    const s = new PIXI.Sprite(this.textures[0]);
    s.anchor.set(0.5);
    this.layer.addChild(s);
    return s;
  }

  update(dt) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.t += dt;
      if (p.t >= LIFE) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.pieces.splice(i, 1);
        continue;
      }

      p.vx *= 1 - DRAG * dt;
      p.vy += GRAVITY * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;

      p.phase += p.flutter * dt;
      // Edge-on for an instant at each half turn, which is what sells it as a flat scrap.
      p.s.width = p.w * Math.cos(p.phase);

      const left = LIFE - p.t;
      if (left < FADE) p.s.alpha = left / FADE;
    }
  }

  reset() {
    for (const p of this.pieces) { p.s.visible = false; this.pool.push(p.s); }
    this.pieces.length = 0;
  }
}
