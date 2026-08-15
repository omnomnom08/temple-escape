// A slow ambient twinkle scattered over given regions — the win card's chest, title and button.
//
// Distinct from shine.js, which fires a tight burst on a cleared cell. This one has no event to
// answer to: it drifts along at a couple of sparkles a second for as long as the card is up, and
// each one lives about four times as long as a gem sparkle. Same texture, so it costs no extra
// bytes; same additive blend, for the same reason — light adds to what is under it, and a white
// sprite laid on top would read as a sticker.
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { VFX_SPARKLE_URL } from './layers.js';

// Sparkles per second across the whole field, shared out by region weight. At this rate and
// LIFE below there are around eight alive at any moment, most of them around the chest.
const RATE = 5;

// Seconds per sparkle. Slow — the point of the effect. A gem sparkle lives 0.44s.
const LIFE = 1.6;

// Size as a fraction of the 64px source, biased small the same way shine.js is: the random is
// squared, so most twinkles are small and a big one is occasional. A flat spread reads as a
// row of identical blobs.
const SIZE_MIN = 0.25;
const SIZE_VAR = 0.75;

// How far one drifts over its life, in px, and roughly upward — light rises.
const DRIFT = 18;

export class SparkleField {
  // regions: shapes in the parent's coordinate space, each with an optional `weight` biasing
  // how often it is picked. Two kinds:
  //
  //   { x, y, width, height }  a rect — suits the title and the button, which are rectangular
  //   { cx, cy, rx, ry }       an ellipse — suits the chest, whose glow is round. It is an
  //                            ellipse and not a circle because the space around the chest is
  //                            not square: there is nothing either side of it, but the WIN
  //                            title and the button close in above and below.
  constructor({ parent, regions }) {
    this.regions = regions;
    this.total = regions.reduce((s, r) => s + (r.weight ?? 1), 0);
    this.pool = [];
    this.texture = null;
    this.t = 0;

    this.layer = new PIXI.Container();
    this.layer.blendMode = 'add';
    parent.addChild(this.layer);
  }

  // Fail-soft: no texture means no sparkles, and nothing downstream has to check.
  async load() {
    await PIXI.Assets.load(VFX_SPARKLE_URL);
    this.texture = PIXI.Texture.from(VFX_SPARKLE_URL);
  }

  update(dt) {
    if (!this.texture) return;
    this.t += dt * RATE;
    while (this.t >= 1) { this.t -= 1; this._one(); }
  }

  _pickRegion() {
    let r = Math.random() * this.total;
    for (const reg of this.regions) {
      r -= reg.weight ?? 1;
      if (r <= 0) return reg;
    }
    return this.regions[this.regions.length - 1];
  }

  _one() {
    const reg = this._pickRegion();
    const s = this.pool.pop() ?? this._create();
    gsap.killTweensOf(s);
    gsap.killTweensOf(s.scale);

    s.visible = true;
    s.alpha = 0;
    if (reg.rx != null) {
      // sqrt, not a plain random, or the points bunch into the middle: area grows with r², so
      // uniform-over-the-ellipse is what actually reaches the outer ring — and the outer ring
      // is the part that reads as spread.
      const r = Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      s.position.set(reg.cx + Math.cos(a) * r * reg.rx, reg.cy + Math.sin(a) * r * reg.ry);
    } else {
      s.position.set(reg.x + Math.random() * reg.width, reg.y + Math.random() * reg.height);
    }
    // Held upright with a little tilt — a four-point cross that spins just wobbles.
    s.rotation = (Math.random() - 0.5) * 0.6;
    const k = SIZE_MIN + Math.random() ** 2 * SIZE_VAR;
    s.scale.set(0);

    // Symmetric in and out, unlike the gem burst's hard punch — nothing struck this one, it
    // simply catches the light and loses it again.
    gsap.to(s.scale, { x: k, y: k, duration: LIFE * 0.45, ease: 'sine.out' });
    gsap.to(s.scale, {
      x: k * 0.1, y: k * 0.1, duration: LIFE * 0.55, delay: LIFE * 0.45, ease: 'sine.in',
    });
    gsap.to(s, { alpha: 1, duration: LIFE * 0.35, ease: 'sine.out' });
    gsap.to(s, {
      alpha: 0,
      duration: LIFE * 0.55,
      delay: LIFE * 0.45,
      ease: 'sine.in',
      onComplete: () => { s.visible = false; this.pool.push(s); },
    });
    gsap.to(s, { y: s.y - DRIFT, duration: LIFE, ease: 'sine.out' });
  }

  _create() {
    const s = new PIXI.Sprite(this.texture);
    s.anchor.set(0.5);
    this.layer.addChild(s);
    return s;
  }

  reset() {
    this.t = 0;
    for (const s of this.layer.children) {
      gsap.killTweensOf(s);
      gsap.killTweensOf(s.scale);
      if (s.visible) { s.visible = false; this.pool.push(s); }
    }
  }
}
