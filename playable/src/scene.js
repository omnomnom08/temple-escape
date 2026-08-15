import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { BG_URL, DOC, layer } from './layers.js';

// The chamber: everything painted and mostly static, placed straight from the PSD's layer
// manifest so nothing here is eyeballed.
//
// The one thing that moves is the pillar. Rubble piling on the grate drives it left, into the
// hero, toward the spikes — so its x offset IS the threat, read directly off pressure. The
// hero is braced against it and travels with it, which is why `pushOffset` is exposed rather
// than the pillar being moved privately.

// How far the pillar travels between no pressure and a crush, in document units. Measured
// from the art: the hero's left edge is at x=432 and the spikes end at x=419, so ~58 units
// of travel is exactly enough to close that gap and no more.
const PILLAR_TRAVEL = 58;

// THE PILLAR GOES OVER THE EDGE. It falls as the object it is — a column tipping over its own
// base — and only comes apart once it is already on its way down. Crumbling it where it stands
// reads as the sprite being deleted; toppling it reads as someone having shoved it.
//
// Pixi rotates about the anchor, so it is re-anchored to its base for the fall. Three quarters
// of the way across rather than the middle: that is the corner a column shoved from the LEFT
// goes over, and the hero is on the left.
const PIVOT_X = 0.75;

// A small lean back before it goes. It is 2° over a tenth of a second — not enough to see as
// movement, enough that the fall reads as something having pushed it rather than the sprite
// simply starting to rotate.
const ANTICIPATE = 0.035;
const ANTICIPATE_T = 0.10;

// How far over it is when it comes apart, and how long that takes. The two are NOT independent
// and neither is chosen by eye.
//
// A column of height H toppling about its base under gravity g reaches an angular rate of
// sqrt(3g/H * (1 - cos O)) by the time it has turned through O. A `power1.in` tween is exactly
// constant angular acceleration (its curve is t²), which covers O in T at a final rate of 2O/T.
// Setting those equal fixes T once O is picked. At O = 1.05 rad (60°), H = 236 units and the
// board's own gravity of 2749 units/s², the rate works out at 4.17 rad/s and T at 0.50s.
//
// So the fall is not eased to taste: it falls at the rate the rest of the scene falls at, and
// the pieces it breaks into inherit a real velocity rather than a made-up one — see FALL_RATE,
// which is what Board2D.collapsePillar spins the debris off with.
const FALL_ANGLE = 1.05;
const FALL_TIME = 0.50;
const FALL_RATE = (2 * FALL_ANGLE) / FALL_TIME;

// The sprite hands over to the rubble rather than cutting to it: it fades while the first pieces
// are already flying, so there is no frame on which both or neither is the pillar.
const SHATTER_FADE = 0.12;

// Painted in the letterbox when the viewport is too extreme for the backdrop to cover.
// Sampled from the darkest brick in bg.png so the seam is hard to find.
export const VOID_COLOR = 0x1a1430;

// Split at the depths the PSD puts them at: the hero stands in front of the pillar, and the
// door assembly draws over both. The board goes on top of everything, which is where the
// plate layers sit in the source file.
const BEHIND = ['wall', 'shadow', 'spikes'];
const FRONT = ['shadow__2', 'door_original_exact', 'step_stone'];

export class Scene {
  static async create() {
    const names = [...BEHIND, ...FRONT, 'pillar'];
    const urls = [BG_URL, ...names.map((n) => layer(n)?.url).filter(Boolean)];
    await PIXI.Assets.load(urls);
    return new Scene();
  }

  constructor() {
    this.root = new PIXI.Container();

    // Backdrop: four static PSD layers baked into one opaque image offline. They never
    // animate, so shipping them separately was ~10 MB of pure overdraw.
    this.bg = PIXI.Sprite.from(BG_URL);
    this.bg.width = DOC.width;
    this.bg.height = DOC.height;
    this.root.addChild(this.bg);

    for (const name of BEHIND) this.root.addChild(this._place(name));

    this.pillar = this._place('pillar');
    this.root.addChild(this.pillar);
    this._pillarHomeX = this.pillar.x;
    this._pillarHomeY = this.pillar.y;
    // Once it has come down it is no longer a wall, and nothing may move it again. See
    // collapsePillar — both setPush and pillarRight read this.
    this.collapsed = false;
    this._collapsedLeft = 0;

    // game.js drops the hero in here — in front of the pillar he is bracing against, behind
    // the doorway, exactly where hero_placeholder sits in the PSD.
    this.heroSlot = new PIXI.Container();
    this.root.addChild(this.heroSlot);

    for (const name of FRONT) this.root.addChild(this._place(name));

    // ...and the board here. The plate layers are the topmost thing in the source file.
    this.boardSlot = new PIXI.Container();
    this.root.addChild(this.boardSlot);

    this.push = 0;
  }

  _place(name) {
    const l = layer(name);
    if (!l) return new PIXI.Container();
    const s = PIXI.Sprite.from(l.url);
    s.x = l.x;
    s.y = l.y;
    s.width = l.width;
    s.height = l.height;
    s.alpha = l.opacity ?? 1;
    s.label = name;
    return s;
  }

  // 0..1 — how far the rubble has driven the pillar, not how hard it is pressing right now.
  // Everything the threat does visually is this one line.
  setPush(p) {
    this.push = Math.min(1, Math.max(0, p));
    // A pillar that has come down cannot be pushed. Without this the per-frame drive from
    // game.update fights the collapse tween for the sprite's x — and wins, because it runs
    // after it — and the shaft wall snaps back to where the pillar used to be.
    if (this.collapsed) return;
    this.pillar.x = this._pillarHomeX - this.push * PILLAR_TRAVEL;
  }

  // The hero is braced against the pillar, so he rides the same offset.
  get pushOffset() { return -this.push * PILLAR_TRAVEL; }

  // The face the rubble bears against. The debris shaft is bounded by this rather than by the
  // board edge, so the mass stays in contact with the pillar as it is driven back — otherwise
  // a strip of empty space opens between them and the rubble stops looking like the cause.
  // Once it has come down the shaft opens out to where the pillar's own left edge was, because
  // that is where its rubble now lies. A stored value rather than one read off the sprite: the
  // sprite is rotating about its base through all of this, and its x is no longer its left edge.
  get pillarRight() {
    return this.collapsed ? this._collapsedLeft : this.pillar.x + this.pillar.width;
  }

  // Win beat one: with the mass gone there is nothing bracing the pillar, and it goes over.
  //
  // The sprite falls as a whole object and then hands over: at the moment it has turned through
  // FALL_ANGLE it fades, and `onCrumble` is handed the column's frame at that instant — where
  // its base is, how far over it has gone, and how fast it is turning — so the debris can be
  // laid out along the fallen column and spun off it carrying its actual motion. Nothing about
  // where the pieces go is authored here; see Board2D.collapsePillar.
  collapsePillar(onCrumble) {
    if (this.collapsed) return gsap.timeline();
    this.collapsed = true;

    const p = this.pillar;
    const rect = { x: p.x, y: p.y, width: p.width, height: p.height };
    // It is still a wall while it is falling. Opening the shaft the moment `collapsed` goes true
    // would let the leftover rubble slump into a pillar the player can still see standing.
    this._collapsedLeft = rect.x + rect.width;

    // Re-anchor to the pivot without moving the sprite a pixel: anchor is normalised texture
    // space, so it survives the width/height _place assigns.
    const px = rect.x + rect.width * PIVOT_X;
    const py = rect.y + rect.height;
    p.anchor?.set(PIVOT_X, 1);
    p.x = px;
    p.y = py;

    const breakAt = ANTICIPATE_T + FALL_TIME;
    const tl = gsap.timeline();
    tl.to(p, { rotation: -ANTICIPATE, duration: ANTICIPATE_T, ease: 'sine.out' }, 0)
      // power1.in, and it has to be: its t² curve IS constant angular acceleration, which is
      // what makes FALL_RATE the honest rate at the bottom of the fall. See the constants.
      .to(p, { rotation: FALL_ANGLE, duration: FALL_TIME, ease: 'power1.in' }, ANTICIPATE_T)
      .call(() => {
        this._collapsedLeft = rect.x;
        onCrumble?.({
          x: px, y: py,               // the base it turned about
          angle: FALL_ANGLE,          // how far over it got
          rate: FALL_RATE,            // rad/s, so the pieces leave with the column's own motion
          length: rect.height,
          width: rect.width,
          pivot: PIVOT_X,
        });
      }, null, breakAt)
      .to(p, { alpha: 0, duration: SHATTER_FADE, ease: 'power1.in' }, breakAt);
    return tl;
  }

  // A retry rebuilds the round the pillar was part of, so it has to stand back up — including
  // the anchor the fall moved, or it would draw three quarters of its width left of home.
  restorePillar() {
    gsap.killTweensOf(this.pillar);
    this.collapsed = false;
    this.pillar.alpha = 1;
    this.pillar.rotation = 0;
    this.pillar.anchor?.set(0, 0);
    this.pillar.x = this._pillarHomeX;
    this.pillar.y = this._pillarHomeY;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
