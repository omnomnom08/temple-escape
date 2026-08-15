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

// The rope escape. The clip is 2.67s and opens on half a second of motionless hang.
const ROPE_SKIP = 0.5;
const ROPE_RATE = 1.3;
const ROPE_FADE = 0.5;
const ROPE_BLEND = 0.15;   // clip cross-fade, and the ramp that hides the hang below

// The clip hangs him well above where he was standing, and that head start is what made the
// whole arc sit high. Measured off hero.glb rather than guessed: the hips key at 0.90 model
// units through idle_0, and the rope clip opens on 1.69 — 0.79u of pure hang. At the rig's
// scale (the body is 2.04u for a 176-unit-tall figure, so ~86 document units per model unit)
// that is 68 units of lift he gets for free, before the tween adds any of its own.
//
// Subtracting it puts the start of the swing at the height he was standing at, so he leaves
// from where he stood instead of popping up to meet a rope that is never drawn. The end comes
// down by the same 68, because this shifts the whole arc rather than reshaping it.
const ROPE_HANG = 68;

// Hand offset at the first frame of the rope clip, from his standing x and the ground line.
// Measured, with ROPE_HANG already applied — see ropeGrabPoint().
const GRAB_DX = 48;
const GRAB_DY = -161;

export class Hero {
  constructor({
    stage, x, footY, height = 200, stageW = Infinity, stageH = 0, onRig = null, onImpact = null,
  }) {
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
    this._opacity = 1;   // one dial over both bodies — see _applyOpacity
    this._layout = null; // last viewport seen; replayed onto the rig when it arrives
    // Fired once, if and when the rig lands. Anything that needs to draw IN FRONT of him has to
    // live in his layer, and until this fires there is no layer to put it in.
    this._onRig = onRig;
    // The frame his feet plant — see update(). Separate from _onLanded, which is the end of the
    // whole drop including the squash.
    this._onImpact = onImpact;

    this._buildPlaceholder();
    this._loadRig();
  }

  // The rig arrives async and replaces the placeholder. Deliberately not awaited by anything:
  // the drop-in runs off update(dt), so a rig that never loads cannot stall the state machine.
  async _loadRig() {
    // hero2, not hero: same skeleton, same six clips keyframe for keyframe, same 2.04u body —
    // a re-export with the mesh cleaned up, so every measurement taken off the first one still
    // holds. The superseded `hero.glb` has been deleted; if it is ever restored, keep it OUT of
    // assets/art/, because art.js globs every .glb below that eagerly — used or not, it lands in
    // the bundle.
    const url = modelURL('hero2');
    if (!url) {
      // Never silently, because the fallback is a painted man who looks enough like the rig to
      // pass. The usual cause is not a missing file at all: art.js finds rigs with
      // import.meta.glob, which resolves when the module is transformed, and Vite's watcher
      // covers its root — assets/ is a level above it. A rig dropped in beside a RUNNING dev
      // server is therefore invisible to it until the server is restarted.
      console.warn('[hero] no rig named hero2 — keeping the 2D placeholder. ' +
        'If the file exists, restart the dev server: assets/ is outside Vite\'s watch root.');
      return;
    }
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
    this._onRig?.(rig);
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

  // Hold the pose he is in and stop answering to fatigue — for the outro, where the pillar going
  // over would otherwise walk him back through every idle on the way to the rope. See
  // hero3d.holdPose. Released by place(), i.e. on a retry.
  holdPose(on = true) {
    this.rig?.holdPose(on);
  }

  // 0..1, how far gone he is — steps him through the three stamina phases. No-op until the rig
  // loads, which is why game.js can call it unconditionally.
  setFatigue(p) {
    this.rig?.setFatigue(p);
  }

  // Which phase that landed him in — 0, 1 or 2 — or null on a build with no rig, where there
  // are no poses to be in and nothing to sync to. The rig owns this because the rig owns the
  // hysteresis; see hero3d's `phase`.
  get fatiguePhase() {
    return this.rig ? this.rig.phase : null;
  }

  // He is braced against the pillar, so he travels with it as the rubble drives it left.
  setOffsetX(dx) {
    if (this.escaping) return; // the escape owns his position once it starts
    this.root.x = this.x + dx;
  }

  // Win beat: the way is clear, so he swings out on the rope.
  //
  // The clip carries its own travel — its hips run +4.26 model units, which is most of the
  // screen's width — so nothing here tweens x. What it does NOT do is gain height: as authored
  // the pendulum ends 1.08u *lower* than it starts. So the rise is added underneath it, eased in
  // so he accelerates away rather than drifting upward from the first frame.
  //
  // Falls back to the door run when there is no rig, because a placeholder build has no swing.
  //
  // `lift` is the rise ADDED to the clip, not the height he ends at. Three things stack, in
  // document units, against the height his hips sat at while he was braced:
  //
  //     +68  the clip's hang, cancelled by ROPE_HANG so it contributes nothing
  //     -93  the clip's own net descent over the arc (1.08u)
  //     +120 this lift
  //
  // — about 28 units of true rise at the end of the swing, roughly a sixth of his height,
  // against ~368 units of travel toward the door. He reads as swung out, not winched up.
  escape(doorX, { duration = 1.7, lift = 120 } = {}) {
    if (!this.rig) return this.runTo(doorX);

    this.escaping = true;
    gsap.killTweensOf(this.root);

    // Skipping the clip's opening half-second: it is a static hang, and this beat has no budget
    // for dead air. The 1.3x on top brings the remaining 2.17s in under the outro's budget.
    this.rig.playOnce('rope', { fade: ROPE_BLEND, hold: true, startAt: ROPE_SKIP, timeScale: ROPE_RATE });

    // The hang is cancelled over the clip's own cross-fade, not on one frame: the mixer is
    // interpolating the body up to the hanging pose across those 150ms, so the root has to come
    // down across the same 150ms. Snap it and he dips a full 68 units and climbs back out.
    const base = this.footY + ROPE_HANG;
    const tl = gsap.timeline();
    tl.to(this.root, { y: base, duration: ROPE_BLEND, ease: 'none' }, 0)
      .to(this.root, { y: base - lift, duration: duration - ROPE_BLEND, ease: 'power2.in' }, ROPE_BLEND)
      .to(this, {
        _opacity: 0, duration: ROPE_FADE, ease: 'power1.in',
        onUpdate: () => this._applyOpacity(),
      }, duration - ROPE_FADE);
    return tl;
  }

  // Take him off the screen for an end card.
  //
  // He needs his own exit because he is not in the Pixi scene the dim covers: the rig draws on
  // #three-canvas, which sits ABOVE #pixi-holder, so the card and the 62% scrim both pass under
  // him and he ends up standing over the FAIL title. Raising the Pixi canvas over the Three one
  // instead would fix the card and break everything else — the whole painted chamber would come
  // with it, including the pillar he is braced against, which would then draw over him.
  //
  // On the win this is already done: the swing faded him out on its way off screen.
  fadeOut(duration = 0.3) {
    return gsap.to(this, {
      _opacity: 0, duration, ease: 'power1.in',
      onUpdate: () => this._applyOpacity(),
    });
  }

  // Where he is on screen, and where his hands are, both in document units. `x` is where he is
  // BRACED, which is not the same thing — the pillar pushes him and the rig stands him off by
  // its own phase offset on top of that. Anything aiming at him wants these, not `x`.
  get bodyX() {
    return this.rig ? this.rig.worldX : this.root.x;
  }

  // The centre of him RIGHT NOW, which is not footY: during the drop-in root.y is wherever the
  // fall has got to, and footY is only where it ends. Anything aiming a camera at him wants this.
  get bodyY() {
    return this.root.y - this.h / 2;
  }

  // Where his hands WILL be on the first frame of the escape — which is not somewhere handPoint()
  // can report, because until the clip has the body they are still braced against the pillar.
  //
  // Measured off hero.glb rather than estimated: the rig posed at the rope clip's start, sitting
  // at footY + ROPE_HANG, puts the hand 48 units downstage of his standing x and 161 above the
  // ground line. Both offsets are properties of the clip, so they follow him wherever he stands
  // and only need remeasuring if the animation is re-exported.
  //
  // This exists because the rope has to be the right LENGTH before he takes hold of it. Guessing
  // put the anchor 720 from his hands when the truth is 790, and the rope visibly changed size
  // at the grab.
  ropeGrabPoint() {
    if (!this.rig) return null;
    return { x: this.bodyX + GRAB_DX, y: this.footY + GRAB_DY };
  }

  handPoint() {
    return this.rig?.handPoint() ?? null;
  }

  _applyOpacity() {
    this.root.alpha = this._opacity;
    this.rig?.setOpacity(this._opacity);
  }

  // The old door run. Still the escape for a build with no rig — see escape() above.
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
    // Both targets: the escape tweens the root's y and the hero's own _opacity, and a retry can
    // land mid-swing. Killing only the root would leave the fade running over the new round.
    gsap.killTweensOf([this.root, this]);
    // A retry after the escape would otherwise start with the body still held on the last frame
    // of the outro.
    this.rig?.resumeLoop();
    this.t = TOTAL;
    this.root.x = this.x;
    this.root.scale.set(1);
    // A retry after the escape starts from a hero who has swung away and faded out.
    this._opacity = 1;
    this._applyOpacity();
    this._apply();
  }

  get landed() { return this.t >= TOTAL; }

  update(dt) {
    if (!this.landed) {
      const was = this.t;
      this.t = Math.min(TOTAL, this.t + dt);
      this._apply();
      // IMPACT is T_FALL, not `landed`. `landed` is TOTAL — 0.22s later, once the squash and the
      // recovery have played out — and dust that arrives after he has finished bouncing is dust
      // from a second landing. Detected as a CROSSING here rather than inside _apply, because
      // place() drives _apply straight to TOTAL on a retry and must not throw any.
      if (was < T_FALL && this.t >= T_FALL) this._onImpact?.();
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
