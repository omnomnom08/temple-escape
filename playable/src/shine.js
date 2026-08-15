// Shine — the light a gem leaves behind when it goes.
//
// A SEPARATE emitter from the stone chips in board2d.js, and separate on purpose rather than
// for tidiness. The two effects are answering different questions:
//
//   chips  = "the plate broke"   — gem-tinted, warm, six pieces, one hit, thrown and gone
//   shine  = "a gem was here"    — white/gold, small, staggered, lingers after the dust
//
// Sharing one emitter would force them onto one rhythm, and a burst that fires everything on
// the same frame reads as a single grey puff. Staggering the sparkles behind the chips is what
// makes this an echo instead of a second explosion, and that stagger is the whole effect.
//
// Cost: one container, one shared texture, and a pool that tops out at about a dozen sprites
// even in a deep cascade. Additive blending is set once on the container, not per sprite, so
// the whole emitter still batches into a single draw call.
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { VFX_SPARKLE_URL } from './layers.js';

// White through to a light gold. NOT the gem's colour — the chips already carry that, and
// tinting the shine too made the cell read as one flat wash of a single hue. Light reads as
// light when it is close to white; the faint warmth just keeps it from looking like a UI
// element pasted over the scene.
const TINTS = [0xffffff, 0xfff8e4, 0xffefc2];

// Sparkles per cleared cell. Deliberately fewer than the six chips — they arrive one at a
// time, so three reads as a twinkle and six reads as a swarm.
const COUNT = 3;

// Seconds between sparkles. This is the "different frequency" from the chip burst: the chips
// land as one hit on the plate-break frame, the sparkles trail in behind them, one every ~90ms,
// so the cell is still twinkling after the stone has finished falling.
const STAGGER = 0.09;

// How long one sparkle lives, and how far it drifts as a fraction of a cell. It barely travels
// — an echo hangs where the thing was rather than flying away from it.
const LIFE = 0.44;
const DRIFT = 0.22;

// Size spread, as a fraction of the 64px source. Wider than it looks: 0.14 to 0.6 is better
// than a 4x range between the smallest and largest glint.
//
// BIASED SMALL, unlike the chips' flat spread — the random is squared, so most sparkles come
// out near the bottom of the range and a big one is occasional. That is what a real sparkle
// field does, and it is what stops three simultaneous glints from reading as three identical
// blobs. A flat spread here gave three mid-sized stars almost every time, which is the thing
// randomness was supposed to fix.
const SIZE_MIN = 0.14;
const SIZE_VAR = 0.46;

export class ShineEmitter {
  // cell: the board's average cell size in design px, the same scalar board2d.js uses for
  // everything that is not a position.
  constructor({ parent, cell }) {
    this.cell = cell;
    this.pool = [];
    this.texture = null;
    this.calls = [];

    this.layer = new PIXI.Container();
    // Light adds to what is under it. Set once, on the container, so every sparkle in it stays
    // in one batch.
    this.layer.blendMode = 'add';
    parent.addChild(this.layer);
  }

  // Fail-soft, like the rest of the art path: if the sparkle never loads the game simply has
  // no shine, and nothing downstream has to check.
  async load() {
    await PIXI.Assets.load(VFX_SPARKLE_URL);
    this.texture = PIXI.Texture.from(VFX_SPARKLE_URL);
  }

  burst(x, y) {
    if (!this.texture) return;
    for (let i = 0; i < COUNT; i++) {
      // Held so a retry can cancel sparkles that have not started yet — otherwise a cascade
      // interrupted by the retry button keeps twinkling over the board it just rebuilt.
      const call = gsap.delayedCall(i * STAGGER, () => this._one(x, y));
      this.calls.push(call);
    }
  }

  _one(x, y) {
    const s = this.pool.pop() ?? this._create();
    gsap.killTweensOf(s);
    gsap.killTweensOf(s.scale);

    // Scattered around the cell rather than centred on it: three sparkles stacked on one point
    // just look like one sparkle flickering.
    const ang = Math.random() * Math.PI * 2;
    const r = this.cell * 0.18 * Math.random();
    s.position.set(x + Math.cos(ang) * r, y + Math.sin(ang) * r);

    s.visible = true;
    s.alpha = 1;
    s.tint = TINTS[(Math.random() * TINTS.length) | 0];
    // Small. The sparkle is 64px of art standing in for a highlight a few pixels across, and
    // at cell size anything bigger stops reading as a glint and starts competing with the gems.
    const k = (this.cell / 64) * (SIZE_MIN + Math.random() ** 2 * SIZE_VAR);
    s.scale.set(0);
    // Upright, with only a little tilt — this art is a four-point cross and spinning it just
    // makes it wobble. Real highlights hold their axis.
    s.rotation = (Math.random() - 0.5) * 0.5;

    const dist = this.cell * DRIFT * (0.4 + Math.random() * 0.6);
    const drift = -Math.PI / 2 + (Math.random() - 0.5) * 1.6; // mostly upward, like rising light

    // In fast, out slow, and the fade runs the whole life rather than waiting — a glint has no
    // hold at full brightness, which is what separates it from a puff of smoke.
    gsap.to(s.scale, { x: k, y: k, duration: LIFE * 0.3, ease: 'back.out(2)' });
    gsap.to(s.scale, {
      x: k * 0.15, y: k * 0.15, duration: LIFE * 0.7, delay: LIFE * 0.3, ease: 'power2.in',
    });
    gsap.to(s, {
      x: s.x + Math.cos(drift) * dist,
      y: s.y + Math.sin(drift) * dist,
      duration: LIFE,
      ease: 'power2.out',
    });
    gsap.to(s, {
      alpha: 0,
      duration: LIFE * 0.72,
      delay: LIFE * 0.28,
      ease: 'power2.in',
      onComplete: () => { s.visible = false; this.pool.push(s); },
    });
  }

  _create() {
    const s = new PIXI.Sprite(this.texture);
    s.anchor.set(0.5);
    this.layer.addChild(s);
    return s;
  }

  // Kill everything in flight and everything queued. Called on retry.
  reset() {
    for (const c of this.calls) c.kill();
    this.calls.length = 0;
    for (const s of this.layer.children) {
      gsap.killTweensOf(s);
      gsap.killTweensOf(s.scale);
      if (s.visible) { s.visible = false; this.pool.push(s); }
    }
  }
}
