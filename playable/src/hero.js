import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { modelURL, modelTextureURL } from './art.js';
import { layer } from './layers.js';

// The explorer.
//
// Two bodies, one interface. The Pixi figure below is a placeholder that draws immediately;
// if a rigged glTF is present it loads in the background and takes over, and the placeholder
// hides. Same upgrade-in-place idiom as board2d's art loading, and for the same reason — the
// game must be playable on the first frame whether or not an asset exists.
//
// The drop is a stub for the real intro, not the intro itself: one beat, under a second.
//
// Deliberately driven by update(dt) off the Pixi ticker rather than by GSAP. Gameplay
// only unlocks once the hero has landed, so this transition must never be able to stall —
// a tween that silently fails to tick would leave the board permanently disabled.

// 0.50, not an arbitrary number: it is where the rig's `land` clip plants its feet. The root
// drop and the body's own landing have to be the same instant or he touches down twice.
const T_FALL = 0.50;
const T_SQUASH = 0.08;
const T_RECOVER = 0.14;
const TOTAL = T_FALL + T_SQUASH + T_RECOVER; // 0.72s

const SQUASH_X = 1.18;
const SQUASH_Y = 0.82;

export class Hero {
  constructor({ stage, x, footY, height = 200, stageW = Infinity, stageH = 0 }) {
    this.h = height;
    this.w = height * 0.42;
    // Keep the whole figure on screen even when the requested spot hugs the left edge.
    this.x = Math.min(Math.max(x, this.w / 2 + 12), stageW - this.w / 2 - 12);
    this.footY = footY;
    this.stageW = stageW;
    this.stageH = stageH;

    this.root = new PIXI.Container();
    this.root.x = this.x;
    this.root.y = footY;
    stage.addChild(this.root);

    this.t = TOTAL;      // already landed until dropIn() rewinds it
    this._onLanded = null;
    this._layout = null; // last viewport seen; replayed onto the rig when it arrives

    this._buildPlaceholder();
    this._loadRig();
  }

  // The rig arrives async and replaces the placeholder. Deliberately not awaited by anything:
  // the drop-in runs off update(dt), so a rig that never loads cannot stall the state machine.
  async _loadRig() {
    const url = modelURL('hero');
    if (!url) return;
    const { create } = await import('./hero3d.js');
    const rig = await create({
      modelUrl: url,
      textureUrl: modelTextureURL('texture_world'),
      canvas: document.getElementById('three-canvas'),
      DESIGN_W: this.stageW,
      DESIGN_H: this.stageH,
      height: this.h,
    });
    if (!rig) return; // no WebGL or a bad file — the placeholder stays
    this.rig = rig;
    // The boot resize almost always beats the rig here, so the viewport has to be replayed or
    // the camera keeps its square-screen placeholder frustum until the next resize event.
    if (this._layout) rig.setViewport(this._layout);
    this.gfx.visible = false;
    this._syncRig();
    // Loading can outlast the drop. If it did not, he still owes us a landing.
    if (!this.landed) rig.playOnce('land', { fade: 0 });
  }

  // Called by game.js on every layout change, rig or no rig.
  setViewport(layout) {
    this._layout = layout;
    this.rig?.setViewport(layout);
  }

  _buildPlaceholder() {
    const art = layer('hero_placeholder');
    if (art) {
      // The painted explorer from the PSD, already in the braced pose. Anchored at the feet
      // so y=0 is the ground line, matching the vector fallback and the 3D rig.
      const s = PIXI.Sprite.from(art.url);
      s.anchor.set(0.5, 1);
      s.width = art.width;
      s.height = art.height;
      this.w = art.width;
      this.h = art.height;
      this.root.addChild(s);
      this.gfx = s;
      return;
    }

    // Fallback if the art is absent — keeps the drop-in beat and the landing spot visible.
    const h = this.h;
    const w = this.w;
    const g = new PIXI.Graphics();
    g.roundRect(-w * 0.38, -h * 0.46, w * 0.76, h * 0.46, w * 0.12).fill(0x6b4a2f); // legs
    g.roundRect(-w * 0.5, -h * 0.82, w, h * 0.40, w * 0.18).fill(0x9c6b3f);         // torso
    g.circle(0, -h * 0.88, w * 0.30).fill(0xe8b98a);                                // head
    g.ellipse(0, -h * 0.96, w * 0.62, w * 0.16).fill(0x4a3320);                     // hat brim
    this.root.addChild(g);
    this.gfx = g;
  }

  // Rig position tracks the Pixi figure, so the drop-in and any later movement are authored
  // once against the 2D layout and the 3D body just follows.
  _syncRig() {
    this.rig?.place(this.root.x, this.root.y);
  }

  // 0..1, how far gone he is — steps him through the three stamina phases. No-op until the rig
  // loads, which is why game.js can call it unconditionally.
  setFatigue(p) {
    this.rig?.setFatigue(p);
  }

  // He is braced against the pillar, so he travels with it as the rubble drives it left.
  setOffsetX(dx) {
    if (this.escaping) return; // the escape owns his position once it starts
    this.root.x = this.x + dx;
  }

  // Win beat: the pillar is off him, so he bolts for the door.
  // Sets `escaping` first so the per-frame pressure offset stops fighting the tween.
  runTo(x, { duration = 1.1 } = {}) {
    this.escaping = true;
    gsap.killTweensOf(this.root);
    const tl = gsap.timeline();
    tl.to(this.root, { x, duration, ease: 'power1.inOut' }, 0)
      // a couple of strides rather than a slide
      .to(this.root.scale, { y: 0.94, duration: 0.16, yoyo: true, repeat: Math.round(duration / 0.16), ease: 'sine.inOut' }, 0)
      .to(this.root, { alpha: 0, duration: 0.25 }, duration - 0.2);
    return tl;
  }

  // Falls in from above and lands. Resolves when settled.
  //
  // The clip and the root drop run side by side rather than one driving the other: `land` plants
  // its feet at 0.50s and so does T_FALL, but if the rig is missing or slow the drop still
  // completes on its own. Landing must never wait on an animation.
  dropIn() {
    this.t = 0;
    this._apply();
    this.rig?.playOnce('land', { fade: 0 });
    return new Promise((resolve) => { this._onLanded = resolve; });
  }

  // Snap straight to the landed pose (retry skips the drop).
  place() {
    this._onLanded = null;
    this.escaping = false;
    gsap.killTweensOf(this.root);
    // A retry after the escape would otherwise start with the body still held on the last frame
    // of the outro.
    this.rig?.resumeLoop();
    this.t = TOTAL;
    this.root.x = this.x;
    this.root.alpha = 1;
    this.root.scale.set(1);
    this._apply();
  }

  get landed() { return this.t >= TOTAL; }

  update(dt) {
    if (!this.landed) {
      this.t = Math.min(TOTAL, this.t + dt);
      this._apply();
      if (this.landed && this._onLanded) {
        const done = this._onLanded;
        this._onLanded = null;
        done();
      }
    }
    // The rig keeps ticking after landing — that is where the strain blend lives.
    if (this.rig) {
      this._syncRig();
      this.rig.update(dt);
    }
  }

  _apply() {
    const t = this.t;
    if (t < T_FALL) {
      const k = t / T_FALL;
      this.root.y = -this.h + (this.footY + this.h) * k * k; // accelerating fall
      this.root.scale.set(1);
      return;
    }
    this.root.y = this.footY;

    if (t < T_FALL + T_SQUASH) {
      const k = (t - T_FALL) / T_SQUASH;
      this.root.scale.set(1 + (SQUASH_X - 1) * k, 1 + (SQUASH_Y - 1) * k);
    } else {
      const k = Math.min(1, (t - T_FALL - T_SQUASH) / T_RECOVER);
      this.root.scale.set(SQUASH_X + (1 - SQUASH_X) * k, SQUASH_Y + (1 - SQUASH_Y) * k);
    }
  }

  destroy() {
    this.rig?.destroy();
    this.root.destroy({ children: true });
  }
}
