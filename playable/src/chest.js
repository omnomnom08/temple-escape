// The win card's chest, and the lure that keeps it alive.
//
// A still image with the motion in code, not a sprite sheet. The sheet cost 118 KB of WebP —
// about 157 KB once base64-inlined — against 26 KB for the still, on a bundle already close to
// the ceilings ad networks impose. What the sheet was actually doing at this size was a hop and
// a squash, and those are two tweens.
//
// ANCHORED ON ITS BASE, which is what makes the squash read as weight: scaling y about the
// bottom edge compresses the chest into the floor rather than shrinking it in place. Every
// position handed in is therefore the point the chest STANDS on, not its centre.
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { layer } from './layers.js';

// The hop, in design px and seconds. Deliberately small: the chest is the prize, not a
// character, and a big jump reads as celebration rather than invitation. It should look like
// the box is nudging you.
const HOP = 26;
const SQUASH = 0.92; // y scale at the bottom of the crouch; x is the inverse so volume holds
const T_CROUCH = 0.16;
const T_RISE = 0.26;
const T_FALL = 0.22;
const T_LAND = 0.10;
const T_SETTLE = 0.20;
// Dead air between hops. Most of the loop, on purpose — a lure that never stops moving stops
// being a lure and becomes noise under the WIN title.
const T_HOLD = 1.15;

export class Chest {
  // cx / cy: the chest's horizontal centre and the base it stands on, in its parent's space.
  constructor({ parent, cx, cy }) {
    const art = layer('chest_closed');
    this.sprite = null;
    this.tl = null;
    if (!art) return;

    const tex = PIXI.Texture.from(art.url);
    const s = new PIXI.Sprite(tex);
    // Never above native — the still is drawn at whichever is smaller, its own size or the box
    // the PSD gives it.
    const k = Math.min(1, art.width / tex.width, art.height / tex.height);
    s.width = tex.width * k;
    s.height = tex.height * k;
    s.anchor.set(0.5, 1);
    s.position.set(cx, cy);
    parent.addChild(s);

    this.sprite = s;
    this.baseY = cy;
    this._start();
  }

  _start() {
    const s = this.sprite;
    // One timeline, looping. gsap drives it off its own clock rather than the game tick, which
    // is fine here: the card is a static overlay, so there is nothing to keep in step with.
    this.tl = gsap.timeline({ repeat: -1 })
      .to(s.scale, { x: 2 - SQUASH, y: SQUASH, duration: T_CROUCH, ease: 'sine.in' })
      .to(s.scale, { x: 1, y: 1, duration: T_RISE * 0.6, ease: 'sine.out' }, `-=${T_CROUCH * 0.1}`)
      .to(s, { y: this.baseY - HOP, duration: T_RISE, ease: 'power2.out' }, `-=${T_RISE * 0.6}`)
      .to(s, { y: this.baseY, duration: T_FALL, ease: 'power2.in' })
      .to(s.scale, { x: 2 - SQUASH, y: SQUASH, duration: T_LAND, ease: 'power2.out' }, '-=0.04')
      .to(s.scale, { x: 1, y: 1, duration: T_SETTLE, ease: 'back.out(2.2)' })
      .to({}, { duration: T_HOLD });
  }

  reset() {
    if (this.tl) this.tl.restart(true);
  }

  destroy() {
    this.tl?.kill();
    if (this.sprite) gsap.killTweensOf([this.sprite, this.sprite.scale]);
  }
}
