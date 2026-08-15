import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { BG_URL, DOC, layer, url } from './layers.js';

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

// THE TRAP — the wall the hero is trapped against, and the two things in it that move.
//
// Placement, in document units. The wall bars and the ceiling beam are document-space layers
// and go where the PSD puts them. The four spike pieces are NOT: they are exported from the
// PSD's smart object in its own 473x593 space, and the document places that object at (296,331)
// scaled to 167x211 — x0.35307 across, x0.35582 down. Every box below is that transform already
// applied, so nothing else in the codebase has to know the smart object exists.
//
// `walls` is the PSD layer clipped at the canvas top: it runs to y -73 in the file, and the
// document never shows above y 0.
const TRAP = {
  walls:   { x: 366,   y: 0,     w: 193,   h: 347 },     // document space, 1:1
  ceiling: { x: 393,   y: 228,   w: 119,   h: 108 },     // document space, 1:1
  recess:  { x: 371.2, y: 339.2, w: 29.0,  h: 197.8 },   // object space (213,23) 82x556
  rods:    { x: 310.8, y: 334.2, w: 108.7, h: 205.3 },   // object space (42,9)  308x577
  plate:   { x: 368.4, y: 331.0, w: 31.8,  h: 209.9 },   // object space (205,0) 90x590
  mask:    { x: 296,   y: 331,   w: 104.2, h: 211.0 },   // object space (0,0)   295x593
};

// The slot the ceiling beam is revealed through, straight off the PSD's `mask` rectangle:
// (393,210) to (512,321). Only the x range is taken from it. The rect is 18 px higher than the
// beam and 3 px shorter, so masking vertically with it as drawn would shave off the bottom lip
// the beam hangs into the niche — the one part of it the player actually reads as a ceiling.
const CEILING_SLOT = { x0: 393, x1: 512 };
const CEILING_SEAL_T = 0.45;

// Where the rods sit, as an offset from the pose the PSD draws them in.
//
// The wall's face — where a rod stops being buried in stone and starts being a spike. Both the
// mask and the hand-over to the 3D layer hinge on it; see liftSpikeTips.
const SPIKE_FACE = 400.2;

// The wall's face is at x 400.2 and the authored tips reach 419.5, so -19.3 would sit them
// FULLY home, level with the stone and invisible. They do not start there. Zero is the pose the
// design comp draws — the whole bank already out, which is how the trap reads as a threat from
// the first frame rather than as seven holes that fill in later.
//
// The two numbers are tuned against each other, not independently: HOME sets where they start
// and CREEP is whatever is left to reach +10 at full pressure, so moving the start does not
// drag the far end with it.
const SPIKE_HOME = 0;
const SPIKE_CREEP = 30;

// The kill. Half the width of the man, in a tenth of a second — the rods have 57 units of tail
// left inside the wall at that point, so nothing runs out of shaft.
const SPIKE_SLAM = 45;
const SPIKE_SLAM_T = 0.09;

export class Scene {
  static async create() {
    const urls = [
      BG_URL,
      layer('pillar')?.url,
      // The trap's pieces are placed from TRAP rather than from the manifest, so they go
      // through url() — layer() insists on a manifest entry and would drop every one of them.
      ...['top_walls', 'top_walls_ceilling', 'spikes_body_back', 'spikes',
        'spikes_body_top', 'spikes_mask'].map((n) => url(n)),
    ].filter(Boolean);
    await PIXI.Assets.load(urls);
    return new Scene();
  }

  constructor() {
    this.root = new PIXI.Container();

    // On a viewport too tall for the backdrop to cover (Layout.cropped — a narrow phone in
    // portrait), there is nothing above document y 0 and the page colour shows through as a
    // lighter band along the top edge. The backdrop is NOT moved up to close it: it is a bake
    // of static PSD layers that the pillar, door and plates are placed against in document
    // coordinates, so sliding it would misalign every one of them. Instead its own top row is
    // stretched upward, which matches column for column — there is no seam at y 0 to find.
    // A full document height of it covers the band at any aspect ratio the layout can produce.
    const bgTex = PIXI.Texture.from(BG_URL);
    this.bgTop = new PIXI.Sprite(new PIXI.Texture({
      source: bgTex.source,
      frame: new PIXI.Rectangle(0, 0, bgTex.width, 1),
    }));
    this.bgTop.x = 0;
    this.bgTop.y = -DOC.height;
    this.bgTop.width = DOC.width;
    this.bgTop.height = DOC.height;
    this.root.addChild(this.bgTop);

    // Backdrop: six static PSD layers flattened into one opaque image in Photoshop — the walls,
    // the fog, and the doorway assembly with them. They never animate, so shipping them
    // separately was ~10 MB of pure overdraw.
    this.bg = PIXI.Sprite.from(BG_URL);
    this.bg.width = DOC.width;
    this.bg.height = DOC.height;
    this.root.addChild(this.bg);

    this._buildTrap();

    this.pillar = this._place('pillar');
    this.root.addChild(this.pillar);
    this._pillarHomeX = this.pillar.x;
    this._pillarHomeY = this.pillar.y;
    // Once it has come down it is no longer a wall, and nothing may move it again. See
    // collapsePillar — both setPush and pillarRight read this.
    this.collapsed = false;
    this._collapsedLeft = 0;

    // game.js drops the hero in here — in front of the pillar he is bracing against, exactly
    // where hero_placeholder sits in the PSD. The doorway used to be drawn over him from a
    // FRONT list; it is in the backdrop now, and he is never near it until the rope carries
    // him out over the top of everything.
    this.heroSlot = new PIXI.Container();
    this.root.addChild(this.heroSlot);

    // The board goes on top of everything, which is where the plate layers sit in the PSD.
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

  // Same, for art whose box does not come from the manifest. The trap's pieces are placed from
  // TRAP because four of the six are exported in the smart object's space and the manifest, by
  // construction, only ever records document-space layer bounds.
  _placeAt(name, b) {
    const u = url(name);
    if (!u) return new PIXI.Container();
    const s = PIXI.Sprite.from(u);
    s.x = b.x;
    s.y = b.y;
    s.width = b.w;
    s.height = b.h;
    s.label = name;
    return s;
  }

  // The wall, its ceiling, and the spikes in it. Back to front, which is the PSD's own order:
  //
  //   walls      the two bars that frame the niche
  //   ceiling    the beam that seals it, revealed left to right after he lands
  //   recess     the dark socket well the rods sit in
  //   rods       the seven spikes — THE thing that moves
  //   plate      the socket plate, in front of the rods so they emerge through its mouths
  //
  // The rods are masked by the wall's own silhouette, INVERSE: the mask is opaque where the
  // stone is and punched through at the seven sockets, so 1-alpha is exactly "where a rod may
  // show". Outside the mask's rect the shader's clip term is 0, which inverts to 1 — so the
  // tips stay visible however far out they are driven, without the mask having to be a mile
  // wide. It has to be a Sprite (Pixi routes anything else to the stencil, which cannot read
  // alpha) and a sibling of the rods, not a child, or it would travel with them.
  _buildTrap() {
    this.trap = new PIXI.Container();
    this.root.addChild(this.trap);

    this.trap.addChild(this._placeAt('top_walls', TRAP.walls));

    this.ceiling = this._placeAt('top_walls_ceilling', TRAP.ceiling);
    this.trap.addChild(this.ceiling);
    // Drawn at full size and scaled in x, so the wipe never re-tessellates the rect.
    this.ceilingMask = new PIXI.Graphics()
      .rect(0, 0, CEILING_SLOT.x1 - CEILING_SLOT.x0, TRAP.ceiling.h)
      .fill(0xffffff);
    this.ceilingMask.x = CEILING_SLOT.x0;
    this.ceilingMask.y = TRAP.ceiling.y;
    this.trap.addChild(this.ceilingMask);
    this.ceiling.mask = this.ceilingMask;
    this.openCeiling();

    this.trap.addChild(this._placeAt('spikes_body_back', TRAP.recess));

    // Two masks, nested, because the wall silhouette alone is not enough. Pulled all the way
    // home the rods are 4.5 units longer than the mask is wide, and an inverse mask shows
    // everything outside its own rect — so the tails came out the far side of it and lay in
    // slivers across the outer wall. The outer clip is that rect's left edge continued to the
    // edge of the document: nothing of the mechanism exists left of the wall it is set in.
    this.spikeClip = new PIXI.Container();
    this.spikes = new PIXI.Container();
    this.rods = this._placeAt('spikes', TRAP.rods);
    this.spikes.addChild(this.rods);
    this.spikeClip.addChild(this.spikes);
    this.trap.addChild(this.spikeClip);

    this.spikeShaft = new PIXI.Graphics();
    this._drawShaft(DOC.width);
    this.trap.addChild(this.spikeShaft);
    this.spikeClip.mask = this.spikeShaft;

    const maskArt = this._placeAt('spikes_mask', TRAP.mask);
    this.trap.addChild(maskArt);
    if (maskArt instanceof PIXI.Sprite) {
      this.spikes.setMask({ mask: maskArt, inverse: true, channel: 'alpha' });
    }

    this.trap.addChild(this._placeAt('spikes_body_top', TRAP.plate));

    this.setSpikes(0);
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

  _drawShaft(right) {
    this.spikeShaft.clear()
      .rect(TRAP.mask.x, 0, right - TRAP.mask.x, DOC.height)
      .fill(0xffffff);
  }

  // The rods are ONE thing in two renderers. Everything past the wall's face has to draw in
  // front of the hero, and Pixi cannot: the rig is on a canvas above the whole display list. So
  // the emerged part is handed to a quad in the hero's own layer, clipped at that same face,
  // and Pixi's copy is cut back to the face in the same breath — what is left of it is the
  // slivers showing through the socket mouths, which is exactly the part he never covers.
  //
  // No-op without a rig: there is nothing in front to get past, and the Pixi rods stay whole.
  liftSpikeTips(rig) {
    if (!rig || this._tips) return;
    this._tips = rig.addOverlay({ url: url('spikes'), rect: TRAP.rods, clipLeft: SPIKE_FACE });
    if (!this._tips) return;
    this._drawShaft(SPIKE_FACE);
    this._setRods(this.rods.x - TRAP.rods.x);
  }

  // The tips are on the hero's canvas, which sits above every Pixi overlay — so the end card and
  // its scrim pass under them exactly as they pass under him. He is taken off by Hero.fadeOut;
  // this is the same beat, for the same reason, and the Pixi rods behind are already cut back to
  // the wall's face, so what is left when they go is a wall with seven sockets in it.
  fadeSpikeTips(duration = 0.3) {
    if (!this._tips) return;
    this._tipFade?.kill();
    const at = { a: 1 };
    this._tipFade = gsap.to(at, {
      a: 0, duration, ease: 'power1.in', onUpdate: () => this._tips.setOpacity(at.a),
    });
  }

  // One offset, both copies, always — they are the same rods.
  _setRods(offset) {
    this.rods.x = TRAP.rods.x + offset;
    this._tips?.setOffsetX(offset);
  }

  // 0..1 — the same number the pillar rides, so the two halves of the threat cannot disagree.
  // The rods creep out of the wall as he loses ground; by the time he is against them they are
  // past the pose the design comp draws.
  setSpikes(p) {
    if (this._slammed) return;   // nothing outranks the kill
    const k = Math.min(1, Math.max(0, p));
    this._setRods(SPIKE_HOME + SPIKE_CREEP * k);
  }

  // The crush. They go the rest of the way, hard, and stay there.
  slamSpikes() {
    if (this._slammed) return gsap.timeline();
    this._slammed = true;
    const at = { o: this.rods.x - TRAP.rods.x };
    this._slam = gsap.to(at, {
      o: SPIKE_HOME + SPIKE_CREEP + SPIKE_SLAM,
      duration: SPIKE_SLAM_T,
      ease: 'power3.in',
      onUpdate: () => this._setRods(at.o),
    });
    return this._slam;
  }

  // The chamber seals itself once he is in it: the beam slides out of the left wall and closes
  // the slot he fell through. It is the mask that moves, not the beam — the beam's own right
  // end is a cut face, so uncovering it left to right IS the slab extruding.
  sealCeiling(duration = CEILING_SEAL_T) {
    gsap.killTweensOf(this.ceilingMask.scale);
    return gsap.to(this.ceilingMask.scale, { x: 1, duration, ease: 'power2.out' });
  }

  openCeiling() {
    gsap.killTweensOf(this.ceilingMask.scale);
    this.ceilingMask.scale.x = 0;
  }

  // A retry does not re-drop him, so the ceiling stays shut; only the spikes go home.
  restoreTrap() {
    this._slam?.kill();
    this._tipFade?.kill();
    this._tips?.setOpacity(1);
    this._slammed = false;
    this.setSpikes(0);
    gsap.killTweensOf(this.ceilingMask.scale);
    this.ceilingMask.scale.x = 1;
  }

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
