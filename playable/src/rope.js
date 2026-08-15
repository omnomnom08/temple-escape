// The outro rope: it swings in from above the top edge into the hero's hands, and carries him
// back out toward the door.
//
// NOTHING HERE IS SIMULATED, and that is the whole design. Two richer versions were tried and
// both failed in the same way. A Verlet chain and, after it, a chain of angular springs: the
// springs gave a lovely bow and then rang, and once the rope was also being pulled onto a moving
// hand every frame the two fed each other and it went to noise. A three-second scripted beat has
// no use for a solver that can be surprising.
//
// So the bend is CLOSED FORM. Every segment is offset from the driven angle by an amount
// proportional to how fast the rope is currently swinging:
//
//     angle(f) = driven - velocity * LAG * f^TIP_BIAS        f = 0 at the anchor, 1 at the tip
//
// which is a first-order expansion of "sample the driven angle f*LAG seconds ago". The rope
// therefore trails its own motion — bowing against the direction of travel, most at the loose
// end — and straightens as the swing decelerates, which is exactly what a rope on a pendulum
// does at the ends of its arc. Nothing accumulates between frames, so nothing can ring, drift,
// blow up, or behave differently at 30fps than at 120. Measured: identical bow to within one
// unit across all three.
//
// The one thing to know if it ever looks stiff again: a UNIFORM trail is still a straight line,
// just at a different angle. The bow comes only from how the trail VARIES along the rope, and
// the sagitta of the resulting arc is about length * total_turn / 8. LAG is what to raise.
//
// The swing itself is one `sine.inOut` tween. That is not an approximation of a pendulum, it is
// a pendulum: simple harmonic motion between two extremes IS a sine. So there is no gravity
// constant here and nothing to reconcile with the scale of the art — the knob is the duration.
//
// AIMING. Where his hands are is not something this module should guess. His on-screen x is the
// braced position plus the rig's phase standoff plus however far the pillar has shoved him, and
// reassembling those three here would go stale the moment any of them changed — all three have
// been retuned already. So the caller hands in an `aim` reporting the rig's actual hand bone,
// and from the grab onward the chain is rotated and stretched onto it. That is safe to do every
// frame here in a way it was not with springs: with no integrator there is no state for the
// correction to disturb.
//
// GEOMETRY. Everything is in document units, the same space as the Pixi board. The anchor sits
// 400 units ABOVE the document top: far enough that it is off-screen in every aspect ratio
// (`Layout.edges.top` runs 0 in portrait to ~280 in 16:9 landscape), so the player never sees
// where the rope is tied.
//
// LAYERING. The rig draws on #three-canvas at z-index 1 and all of Pixi is below it, so the
// rope is behind the hero no matter which container it is added to. That is the right way
// round: once he takes hold, his hands cover the cut end of the tile and it needs no cap.
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { VFX_ROPE_URL } from './layers.js';

// Anchor, in document units. x sits between where he is braced (~490) and the door (858) so the
// same pendulum reaches both: the swing in is about -14 degrees and the swing out +16.
const ANCHOR = { x: 660, y: -400 };

// Fallback distance from the anchor to the tip, for a caller that supplies no grab point. The
// real one is computed per-play from that point, because it HAS to match: the rope was 720 here
// against a true 790, and the 9% it gained at the grab read as the rope being swapped for a
// different one.
const LENGTH = 790;

// Drawn thickness in document units, against a hero 118 wide and 200 tall. This also sets the
// braid's repeat distance, because Pixi derives both from the same value (see load()), so the
// twist stays in proportion whatever this becomes.
const THICKNESS = 16;

// Points down the rope. Enough that the bow reads as a curve rather than a dogleg.
const SEGMENTS = 14;

// Seconds of trail at the tip — the flex, and the first knob to reach for. At 0 the rope is a
// rigid stick. At 0.9 the bow peaks around 60 units mid-swing against a 720-unit rope and falls
// to under 5 by the time he takes hold, because the swing has stopped by then.
const LAG = 0.9;

// Exponent on the trail's distribution. 1 is a uniform arc; 2 concentrates the bend in the
// bottom third, where a rope carries least tension, and reads more like rope than like wire.
const TIP_BIAS = 2;

// Smoothing on the velocity estimate. A raw per-frame difference is noisy enough to make the
// bow jitter; this is short enough not to soften the whip.
const VEL_SMOOTH = 0.08;

// Ceiling on that estimate, in radians per second. The beat's own peaks are around 0.7, so this
// is loose enough never to touch them and tight enough that a one-frame discontinuity — the
// handover from the tween to the hand, most obviously — cannot throw the rope off screen.
const MAX_VEL = 3;

// The beats. There is deliberately no payout: the rope was authored to unfurl to length as it
// came in, and at this scale that reads as a separate event happening next to the swing rather
// than as part of it — the eye follows the growing end instead of the arc. It comes in at full
// length and fades up instead, which keeps the swing the only thing moving.
const FADE_IN = 0.4;      // over the top of the swing below, not before it
const SWING_IN = 1.10;    // half a pendulum period, from the far side across to him
const SETTLE = 0.15;      // the last of the trail unwinding once the driven angle has arrived
const SWING_OUT = 1.67;   // the rope clip's 2.17s at its 1.3x — see hero.js
const FADE_OUT = 0.5;

export class Rope {
  constructor({ parent, anchor = ANCHOR, length = LENGTH, thickness = THICKNESS } = {}) {
    this.anchor = { ...anchor };
    this.length = length;
    this.thickness = thickness;

    this.mesh = null;
    this.texture = null;

    // The driven angle, in radians, 0 being straight down and positive swinging screen-right.
    // gsap tweens this directly; the shape of the rope is derived from it and its rate of change.
    this._angle = 0;
    this._prev = 0;
    this._vel = 0;

    // Anchor-to-tip distance for this play. Derived from the caller's grab point so that the
    // rope he swings in on and the rope he takes hold of are the same rope.
    this._reach = length;

    // Set at the grab: a function reporting where the rig's hand actually is, in document units.
    // While it returns a point, that point wins over anything the tween is doing.
    this._aim = null;

    this.points = Array.from({ length: SEGMENTS }, () => new PIXI.Point(anchor.x, anchor.y));
    this.parent = parent;
  }

  // Fail-soft, the same contract as sparkle.js: no texture means no rope and the caller does
  // not have to check. The outro still plays — he simply swings on nothing, which is what it
  // did before this module existed.
  async load() {
    try {
      await PIXI.Assets.load(VFX_ROPE_URL);
      this.texture = PIXI.Texture.from(VFX_ROPE_URL);
    } catch (e) {
      console.warn('[rope] texture failed to load — the outro will run without it', e);
      return null;
    }

    // MeshRope pins the geometry's width to texture.height on every render and derives BOTH the
    // drawn thickness and the along-rope repeat distance from it (`textureScale * _width`). So
    // the two are necessarily equal, which is why the tile is square: one full braid twist per
    // texture, laid down every `thickness` units. The source tile's twist pitch is 32px against
    // a 32px diameter, so it maps 1:1 with no distortion. A non-square tile would be squashed.
    this.mesh = new PIXI.MeshRope({
      texture: this.texture,
      points: this.points,
      textureScale: this.thickness / this.texture.height,
    });
    this.mesh.visible = false;
    this.parent?.addChild(this.mesh);
    return this.mesh;
  }

  // A document x on the tip's arc -> the angle that puts the tip there. The caller thinks in
  // board coordinates ("the door"); the pendulum is an implementation detail. Against the
  // CURRENT reach, not the default, or the fallback swing-out would aim at the wrong arc.
  // Clamped because a target beyond the rope's reach has no solution.
  angleFor(x) {
    return Math.asin(Math.max(-1, Math.min(1, (x - this.anchor.x) / this._reach)));
  }

  update(dt) {
    if (!this.mesh || !this.mesh.visible || dt <= 0) return;

    const ax = this.anchor.x;
    const ay = this.anchor.y;
    // `aim` may legitimately return null — before the rig has the rope pose, or on a build with
    // no rig at all. Falling back to the tween rather than to nothing is what stops a missing
    // hand from freezing the rope mid-air, which is exactly what it did once.
    const target = this._aim?.() ?? null;

    // WHERE THE TIP MUST END UP: the hand while aiming, the tween otherwise. Velocity is
    // measured from THIS and never from the angle derived below — deriving it from its own
    // output is a feedback loop with a gain of LAG/dt, about 54 per frame at 60fps, and it
    // diverges within three frames. That mistake has now been made twice in this file.
    const base = target
      ? Math.atan2(target.x - ax, target.y - ay)
      : this._angle;

    const raw = (base - this._prev) / dt;
    this._prev = base;
    // Clamped: the switch to the hand at the grab is a small step change, and this stops that
    // one frame from being read as enormous speed and flicking the rope across the screen.
    this._vel += (Math.max(-MAX_VEL, Math.min(MAX_VEL, raw)) - this._vel)
      * Math.min(1, dt / VEL_SMOOTH);

    const trail = this._vel * LAG;

    // How far the tip has to be from the anchor: onto the hand while aiming, its own length
    // otherwise. The clip lifts his hands ~28 units over the swing, which is 4% of the length —
    // a fraction of a braid twist, and invisible against a tiling texture.
    const wanted = target
      ? Math.hypot(target.x - ax, target.y - ay)
      : this._reach;

    // TWO PASSES, and the second is not optional. The tip's bearing from the anchor is the sum
    // of all thirteen segments, NOT the angle of the last one — so there is no closed form for
    // "which driven angle puts the tip on the hand". Pass one lays out the shape; pass two
    // rotates and scales it so the tip lands exactly. Rotation does not change length and
    // scaling does not change bearing, so the corrections are independent and one pass fixes
    // both. Nothing here is written back into the state the next frame reads — that is the
    // difference between this and the two earlier versions that fed themselves and diverged.
    this._build(wanted / (SEGMENTS - 1), base, trail);
    const tip = this.points[SEGMENTS - 1];
    const dist = Math.hypot(tip.x - ax, tip.y - ay);
    if (dist > 1e-3) {
      const turn = base - Math.atan2(tip.x - ax, tip.y - ay);
      this._build((wanted / (SEGMENTS - 1)) * (wanted / dist), base + turn, trail);
    }
  }

  // Lay the chain out from the anchor, each segment trailing the driven angle by an amount that
  // grows toward the tip. See the header: the bow is the VARIATION in that trail, not its size.
  _build(seg, driven, trail) {
    const p = this.points;
    p[0].set(this.anchor.x, this.anchor.y);
    for (let i = 1; i < SEGMENTS; i++) {
      const f = i / (SEGMENTS - 1);
      const a = driven - trail * Math.pow(f, TIP_BIAS);
      p[i].set(p[i - 1].x + seg * Math.sin(a), p[i - 1].y + seg * Math.cos(a));
    }
  }

  // The whole outro, as one timeline.
  //
  // `grab` is the POINT his hands will be at when the clip takes the body — not where he is
  // standing, and not somewhere the rig can be asked for, since until the clip runs his hands
  // are still on the pillar. The whole rope is sized from it: reach is the distance from the
  // anchor to that point, so the rope swinging in is the same length as the one he takes hold
  // of. Getting this from a guessed hand height instead is what made it look like two ropes.
  //
  // `onGrab` fires at the moment he takes hold, which is where the caller starts hero.escape().
  //
  // It opens on the mirror of the grab angle, so the rope comes in from the far side and the
  // swing is a symmetric half-period. A symmetric swing is also the one that neither gains nor
  // loses height, which is what the clip does: 368 units across for 28 of rise.
  play({ grab, exitX = 858, onGrab, aim = null } = {}) {
    const grabAt = SWING_IN + SETTLE;

    if (!this.mesh) {
      // No texture: still fire the grab on schedule so the outro is not held up by decoration.
      return gsap.timeline().call(() => onGrab?.(), null, grabAt);
    }

    const ax = this.anchor.x;
    const ay = this.anchor.y;
    const to = grab ?? { x: 490, y: ay + this.length };
    this._reach = Math.hypot(to.x - ax, to.y - ay);

    const grabA = Math.atan2(to.x - ax, to.y - ay);
    const start = -grabA;              // mirrored across the anchor
    const exit = this.angleFor(exitX);

    gsap.killTweensOf([this, this.mesh]);
    this._aim = null;
    this._angle = start;
    this._prev = start;
    this._vel = 0;
    this.mesh.alpha = 0;
    this.mesh.visible = true;

    const tl = gsap.timeline()
      // Full length from the first frame, fading up over the top of the swing. The cut end of
      // the tile is therefore only ever seen while it is translucent and travelling fast, which
      // is the same cover the payout used to provide and costs nothing.
      .to(this.mesh, { alpha: 1, duration: FADE_IN, ease: 'sine.out' }, 0)
      // Half a pendulum period across to him. sine.inOut decelerates into the extreme, so he
      // takes hold at the top of the arc, where the rope is momentarily still — and, because the
      // bow is proportional to speed, momentarily straight.
      .to(this, { _angle: grabA, duration: SWING_IN, ease: 'sine.inOut' }, 0)
      .call(() => { this._aim = aim; onGrab?.(); }, null, grabAt)
      // ALWAYS scheduled, even with an aim. While the hand is reporting, update() ignores this
      // and tracks the hand instead; the moment it stops reporting the rope keeps swinging out
      // on its own. It used to be conditional, and a hand that never reported left the rope
      // hanging at the grab angle for the rest of the outro.
      .to(this, { _angle: exit, duration: SWING_OUT, ease: 'sine.inOut' }, grabAt);

    return tl.to(this.mesh, { alpha: 0, duration: FADE_OUT, ease: 'power1.in' },
      grabAt + SWING_OUT - FADE_OUT);
  }

  // A retry can land anywhere in the timeline above.
  reset() {
    gsap.killTweensOf([this, this.mesh]);
    this._aim = null;
    this._angle = 0;
    this._prev = 0;
    this._vel = 0;
    if (this.mesh) {
      this.mesh.visible = false;
      this.mesh.alpha = 1;
    }
  }

  destroy() {
    gsap.killTweensOf([this, this.mesh]);
    this.mesh?.destroy();
    this.mesh = null;
  }
}
