import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { Match3, EMPTY } from './match3.js';
import { DebrisSim } from './debris_sim.js';
import { DebrisRenderer } from './debris_pixi.js';
import { loadRockAtlas } from './art.js';
import { layer } from './layers.js';
import { ShineEmitter } from './shine.js';

// 2D gameplay board (Pixi). Replaces board3d.js — the 3D scene is now intro-only.
//
//   plates = the grate. One per grid cell, and it NEVER moves — not for a swap, not for a
//            match, not for anything. A plate stands exactly while its cell holds a gem, so
//            the wall erodes into the shape the player cut into it.
//   gems   = what the player matches. Only gems move, and only during a swap.
//   rubble = a granular mass the grate holds back; it pours through the holes and drains.
//
// The rules live in match3.js and debris_sim.js; this file is layout, art and input.

// Four gems, in the order they appear on the sheet: teardrop, square, diamond, heart.
// These tints are only used before the art loads (and as the fallback if it never does);
// once gems.png is present the sprite carries its own colour.
//
// THREE, and it is a readability call rather than a starvation one. Measured over 200 seeded
// runs on this board, colour count barely moves the clear rate (3 -> 87.2%, 4 -> 84.8%,
// 5 -> 82.2%) and stranded tiles cannot block a win anyway, because the win is "rubble
// drained", not "board cleared". More distinct shapes is simply slower to read at cell size,
// and an ad is judged on comprehension in the first two seconds.
//
// The dropped one is the yellow diamond (gem_orange_diamond.webp, still in assets/): against
// the sandstone backdrop and the yellow pillar it was the least separable of the four.
const COLORS = [0x4fc3f7, 0x5ec46a, 0xff5b6b];

// Chip tints, derived from COLORS so the two can never drift apart.
//
// Pixi's tint is a MULTIPLY, and the chip art is warm sandstone (mean RGB ~228,190,126), so
// tinting it with a gem colour straight lands darker and warmer than the gem: the base has
// almost no blue in its midtones, and the blue gem comes out muddy teal. Lifting each tint a
// quarter of the way to white keeps the chip body bright enough to read as the gem's colour
// while the art's own shading still comes through. The highlights, which do reach near-white
// in all three channels, carry the true hue.
const lift = (hex, k = 0.25) => {
  const ch = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
    .map((v) => Math.round(v + (255 - v) * k));
  return (ch[0] << 16) | (ch[1] << 8) | ch[2];
};
const CHIP_TINTS = COLORS.map((c) => lift(c));

// Base chip scale, as a fraction of cell size — the sprite is multiplied by cell * CHIP_SCALE,
// so the chips hold their proportions if the grid ever changes. The three source textures are
// different sizes, so this sets the burst's overall grain rather than one chip width.
const CHIP_SCALE = 1 / 200;

// Per-chip size spread, as a multiple of CHIP_SCALE. Flat random rather than the biased curve
// the sparkles use: stone breaks into a bit of everything, so no size should be more likely
// than another. MIN + VAR/2 == 1, which keeps the mean at the base size.
const CHIP_SIZE_MIN = 0.55;
const CHIP_SIZE_VAR = 0.9;

// How much of the plate the chips launch from, as a fraction of the cell. The plate is what is
// breaking, so the whole face of it should shed pieces — at anything much below this the
// scatter is there in the numbers but the burst still reads as coming out of a single point.
const CHIP_SPAWN_AREA = 0.9;

// Chips per burst — a RANGE, not a number. An identical count every time is the strongest tell
// that a burst is canned, because counting silhouettes is something the eye does for free.
// 4..8 averages the 6 it replaces, so the effect keeps its weight.
const CHIP_MIN = 4;
const CHIP_VAR = 4;
// Radians the whole fan tilts off vertical, per burst. Every spray being symmetric about
// straight up was the other half of the sameness; a slab does not break evenly.
const CHIP_LEAN = 0.9;
// Seconds over which a burst's chips launch. Not a rhythm like the shine's stagger — just
// enough scatter that the spray unfolds rather than appearing whole on one frame.
const CHIP_STAGGER = 0.05;

// Ballistics. Speed and gravity are in cell-widths per second and per second squared, so the
// arcs keep their proportions if the grid ever changes size.
//
// These three are a set and must be tuned together — they decide where the apex falls in the
// flight, which is the whole readability of the effect. At these values a chip thrown straight
// up turns over about a third of the way through its life: long enough to read as a rise, early
// enough that most of what the eye sees is the fall. Push speed up or gravity down and the
// chips leave the board still climbing; the reverse and they drop like the plate spat them out.
// Kept deliberately contained: a chip should land within about a cell of the plate it came
// off, not sail across the board. Fall distance goes with the SQUARE of life, so life is the
// strongest of the three — trimming it is what pulls a long arc back in without flattening it.
const CHIP_SPEED_MIN = 1.0;
const CHIP_SPEED_VAR = 0.9;
const CHIP_GRAVITY = 10;
const CHIP_LIFE_MIN = 0.40;
const CHIP_LIFE_VAR = 0.16;

// Rubble packing. These three numbers are related and must move together.
//
// PACK is the rock-vs-rock contact grid, as a fraction of a board cell. DRAW is the sprite
// size. The rock art only fills about 80% of its frame (measured — tools/rockbox.mjs), so a
// rock drawn at DRAW is visually DRAW*0.8 across.
//
// The pile reads as gappy when diagonal neighbours are further apart than a rock is wide:
// diagonal spacing is PACK*sqrt(2), so it has to stay under DRAW*0.8. At the old 0.40/0.42
// that left a 15px hole between every diagonal pair — the mass looked like a lattice. At
// 0.30/0.52 the diagonal gap is ~0, and the rubble reads as solid.
const PACK = 0.30;
const DRAW = 0.52;

// How many rocks tile one board cell at this pack size. Lets capacity be expressed as a
// physical volume rather than a magic number.
const ROCKS_PER_CELL = 1 / (PACK * PACK);

// How deep the rubble stands above the wall at pressure 1.0, in grid cells. This is the
// real balance knob: capacity is derived from it, so changing the grid never silently
// changes how much rubble constitutes a crush.
//
// 7, not 11. At 11 the mass could never accumulate enough to reach pressure 1.0 — measured
// peak was 0.77 even at a punishing inflow — so the round was literally unloseable.
const FULL_DEPTH_CELLS = 7;

// Lateral force on the pillar that constitutes a crush. Measured, not guessed. Force is
// superlinear in rock count — a deep pile presses far harder than a shallow one carrying the
// same rocks spread out — which is why this cannot be expressed as a count.
//
// 130, down from 260, because the force it is scaled against changed meaning: pressure now
// counts only the mass standing on the grate, not every rock that happens to be beside the
// pillar's x (see rawPressure). Re-swept against player pace at 40 rounds a cell, with a bot
// that always takes the hint:
//
//        pace     1.4s/move   2.5s/move   4.0s/move
//   crush 260        65%         50%         65%      <- meter never leaves its bottom third
//   crush 180        78%         78%         63%
//   crush 130        73%         83%         65%      <- and failure is a crush, not a stall
//
// At 130 the pressure meter uses its range (peak averages 0.52-0.65), every round resolves,
// and a slow player genuinely gets crushed rather than timing out.
const CRUSH_FORCE = 130;

// Force at or below which the threat is over.
//
// Much lower than the old count-based threshold, and that is the force model paying off: a
// thin scattering of leftover rocks on blocks that will never clear genuinely does not push
// anything. Under the old census those same rocks still counted as danger, which is why the
// win threshold had to be set implausibly high to be reachable at all.
const WIN_AT = 0.06;

// The mass must also be gone by count, not just by force — force reads low for a moment
// whenever the rubble is out of contact with the pillar.
const WIN_ROCK_FRACTION = 0.18;

// The threat has to have been real before it can be over. Below this the round has not
// started in earnest, and a win cannot fire.
//
// 0.15, not 0.25: with the grate draining from the first plate the mass no longer has to get
// deep before the player is on top of it, and a well-played round could finish having never
// tripped the old threshold — so the win could not fire and the round hung. Measured at 0.25:
// 21 of 40 rounds timed out. At 0.15: none.
const ARM_AT = 0.15;

// How fast the displayed pressure chases the raw contact force. ~0.17s: fast enough that an
// avalanche registers immediately, slow enough that the pillar does not judder.
const PRESSURE_LAG = 6;

// Once the rubble stops arriving AND the mass stops shrinking, nothing can change again —
// what is left is stranded on blocks that will never clear. Resolve the round rather than
// leaving the player staring at a stalemate.
//
// Measured on the rock count rather than on "is anything still moving", because a few rocks
// jostle against the pack grid indefinitely and the moving count never actually reaches zero.
const STALL_SECONDS = 2.5;

// THE ROUND HAS A FIXED AMOUNT OF RUBBLE IN IT. `capacity` rocks arrive and no more, ever:
// enough to stand FULL_DEPTH_CELLS deep, which fills the shaft from the grate to the top of
// the screen. Most of it is seeded, the rest rains in over the opening seconds, and the flow
// closes for good the moment the first rock drains through the grate.
//
// It used to be a tap that ran until 55% of the BOARD was cleared, which is the wrong quantity
// to measure a physical mass against: the shaft filled past the top of the screen, rocks
// arrived faster than a well-played board could drain them, and the mass the player was
// fighting had no size — it was however much had fallen in so far.
//
// Seeding all of it at once instead would cost the opening beat, which is rubble visibly
// raining onto the grate and burying him. 0.7 leaves enough of that to read.
const START_FILL = 0.7;

// The pillar creeps, it does not track. Load presses him toward the spikes over time, so the
// threat is sustained weight rather than an instantaneous reading — which is the only model a
// fixed mass can be lost to: a pile of settled rubble exerts a steady force, and if the pillar
// simply mirrored that force it would stop where the force stopped and the round could never
// be lost. Seconds at FULL load to close the gap between him and the spikes.
//
// 10. It was 14, chosen when the fail state could not fire at all (see setLeftBound) — so the
// number had never actually been measured against a round that ends. Once it could, 14 meant
// standing still for 17.1s before the spikes got you, which is most of an ad break spent
// watching nothing happen.
//
// 10 puts a hands-off death at 13.0s. Lower is tempting and does not survive contact: at 8 the
// death is 11.4s but an unhurried player loses ten rounds in twelve, and this is an ad — the
// chest is the payoff, so losing has to be a real possibility rather than the usual outcome.
// At 10 a brisk player still wins every round and a dawdling one is in genuine trouble.
const CREEP_SECONDS = 10;

// Below this the mass is no longer bearing on the pillar face, and he pushes back — at a fixed
// slow rate, because a shaft that has just drained should visibly give him ground back.
const CREEP_AT = 0.12;
const RELIEF_SECONDS = 6;

// How much rubble has to leave before the drain is worth announcing, and how long the
// announcement holds the floor afterwards. ~10 rocks is one visible gout through a hole.
const DRAIN_BATCH = 10;
const DRAIN_HOLD = 0.9;

const T_SWAP = 0.16;
const T_CLEAR = 0.16;
// How long a plate takes to crumble once its gem is gone. The hole opens on the LAST frame of
// this, never before — see _removePlate.
const T_PLATE = 0.18;
// The survivors dropping into the gap afterwards. Short: it runs once per cascade step, and
// the rubble is standing on the thing that is moving, so a long fall reads as the wall
// hesitating under the weight rather than settling.
const T_DROP = 0.14;

export class Board2D {
  constructor({
    stage, geom, docH,
    rows = 6, cols = 5,  // matches the layout PSD's plate grid
    capacity = null,     // rocks bearing on the wall at pressure 1.0 = crush = FAIL.
                         // Derived from the grid below unless overridden.
    // Fraction of the round's rubble that is already in the shaft when play starts; the rest
    // rains in. Both halves come out of the same fixed budget — see START_FILL.
    startFill = START_FILL,
    // Rocks/sec arriving — how fast the rest of the budget lands, not how long it lasts.
    // Scales with ROCKS_PER_CELL: tighter packing means more rocks make up the same visible
    // pile, so the rate has to rise with it or the mass grows in slow motion.
    inflowRate = 20,
    // onSwap(valid) fires on every gesture that lands on two adjacent cells, including the
    // ones that make nothing — "that did not work" is feedback the player needs immediately,
    // and the bounce-back animation alone is easy to miss on a phone.
    onClear, onFirstMove, onFlow, onSwap, onDrain,
  } = {}) {
    this.ROWS = rows;
    this.COLS = cols;
    this.onClear = onClear;
    this.onFirstMove = onFirstMove;
    this.onSwap = onSwap;
    this.onDrain = onDrain;

    this.enabled = false;
    this.busy = false;
    this.movedOnce = false;
    this.drag = null;
    this._pressure = 0;
    // How far the rubble has driven the pillar into him, 0..1. Distinct from pressure: that is
    // the load right now, this is what the load has done to him so far, and it is the one the
    // round is lost on.
    this._push = 0;
    this._armed = false;
    this._seededCount = 0;
    this._lastDrained = 0;
    this._drainHold = 0;

    // The wall the rubble actually rests on: one flag per cell, true while a plate is still
    // standing there. This is the RENDERED wall, not the match-3 grid — the grid clears the
    // instant a swap resolves, half a second before the plate has finished coming apart on
    // screen, and draining through a plate the player can still see is the bug this separates.
    // Two things write it, both at the end of an animation the player has watched finish:
    // _removePlate opens the matched cell as the crumble ends, and _settleWall re-reads the
    // whole wall once the survivors have landed.
    this.plateSolid = Array.from({ length: rows }, () => Array(cols).fill(true));
    // Pending crumbles, so a retry mid-cascade cannot open a hole in the board it just rebuilt.
    this._plateCalls = [];

    // ---- layout: taken from the PSD, not computed ----
    // The grid sits in a painted recess in the backdrop, so its position and spacing have to
    // match the art exactly. Cells are NOT square (plates are 63x69), which is why width and
    // height are tracked separately — forcing a square cell would stretch every plate ~9%
    // and walk the grid off its recess.
    this.originX = geom.originX;
    this.originY = geom.originY;
    this.cellW = geom.cellW;
    this.cellH = geom.cellH;
    // One scalar for everything that is not a position: rock size, gravity, contact radius.
    this.cell = (this.cellW + this.cellH) / 2;
    this.boardW = this.cellW * cols;
    this.boardH = this.cellH * rows;

    this.root = new PIXI.Container();
    this.rubbleLayer = new PIXI.Container();
    this.blockLayer = new PIXI.Container();
    this.gemLayer = new PIXI.Container();
    // rubble behind the wall so it reads as being held back, and spills into the gaps
    this.fxLayer = new PIXI.Container();
    this.root.addChild(this.rubbleLayer, this.blockLayer, this.gemLayer, this.fxLayer);
    this.chipPool = [];

    // Its own emitter, added last so the light lands over the dust. See shine.js for why the
    // two effects are not one.
    this.shine = new ShineEmitter({ parent: this.root, cell: this.cell });
    stage.addChild(this.root);

    this.logic = new Match3({ rows, cols, colors: COLORS.length });

    // Capacity as a physical volume — "rubble standing FULL_DEPTH_CELLS deep across the
    // board" — rather than a bare count. Expressed this way it survives a grid change:
    // a narrower board needs proportionally less rubble to mean the same crush, and the
    // number no longer has to be re-guessed every time the layout moves.
    if (capacity == null) capacity = Math.round(ROCKS_PER_CELL * cols * FULL_DEPTH_CELLS);

    this.sim = new DebrisSim({
      // The pool must exceed capacity, or pressure can never reach 1.0 and the game
      // can never fail. Headroom covers rocks in flight below the drain line.
      max: Math.round(capacity * 1.15),
      // Weight is mostly these three. Rubble reads as light when it drifts down at a
      // constant speed and bounces on landing; it reads as heavy when it accelerates hard,
      // reaches a high terminal velocity, and stops dead.
      gravity: this.cell * 42,
      maxFall: this.cell * 30,
      bounce: 0.06,
      freezeSpeed: this.cell * 0.04,
      flowSpeed: this.cell * 5,
      // Just under the grate: a rock has escaped once it is out the far side of the board,
      // not when it enters the near side.
      drainY: this.originY + this.boardH + this.cell * 0.6,
      // The shaft walls. The rubble is confined to the width of the grate it rests on, so
      // it can only ever leave by draining through the board.
      bounds: { left: this.originX, right: this.originX + this.boardW },
      solidAt: (x, y) => this._solidAt(x, y),
      packCell: this.cell * PACK,   // rock-vs-rock contact, so the mass has real depth
      onFlow,
    });
    this.debris = new DebrisRenderer(this.sim, { size: this.cell * DRAW });
    this.rubbleLayer.addChild(this.debris.container);

    // Rubble arrives above the wall and bears down on it. Everything below the wall's
    // bottom edge has already escaped and no longer counts as pressure.
    this.capacity = capacity;
    this.startFill = startFill;
    this.inflowRate = inflowRate;
    // Where the threat ends. The grate's own surface, not its far side: a rock that has gone
    // through the grate is already past him and on its way out of frame, and counting it as
    // rubble still bearing down meant the round could not be called until it had physically
    // left the picture. Same line the force is cut off at, for the same reason.
    this.threatLineY = this.originY;
    // Kept so setSpawnY can move it once the layout is known.
    this._inflowRect = {
      x: this.originX,
      y: this.originY - this.cell * 5.5,
      width: this.boardW,
      height: this.cell * 0.5,
    };
    this.sim.setInflow(0, this._inflowRect);

    this._buildBlocks();
    this._buildGems();
    this._syncAll();
    this._bindInput();
    this._loadArt();
  }

  // ---- coordinates ----

  cellX(c) { return this.originX + (c + 0.5) * this.cellW; }
  cellY(r) { return this.originY + (r + 0.5) * this.cellH; }

  cellAtPoint(x, y) {
    const c = Math.floor((x - this.originX) / this.cellW);
    const r = Math.floor((y - this.originY) / this.cellH);
    if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return null;
    return { r, c };
  }

  // What holds the rubble back. A pure grid lookup — no physics engine.
  //
  // THE WALL IS A STACK, ONE PER COLUMN. Gravity puts every survivor at the bottom of its
  // column and every hole at the top, so what the rubble is standing on is the top face of
  // each column's remaining plates. Clear a cell and that face drops one row: the mass sinks
  // into the pocket it has just eaten, and a column cleared end to end lets it fall straight
  // out of the shaft. So the wall answers per cell, honestly, with no special cases.
  //
  // This is why there is no longer a `throughGrate` shortcut. When holes could open anywhere
  // (no gravity), a rock that found one had to be let past everything below it, or the panel
  // was six courses of masonry with holes that never lined up — measured, 24 of ~430 rocks
  // drained and every round stalled. With the holes stacked at the top the same shortcut
  // becomes the opposite problem: one clear anywhere in a column would open that column all
  // the way down, and the shaft would empty in two matches. Falling tiles fix the alignment
  // problem properly, so the hack that stood in for them is gone.
  //
  // The pressure cut-off at the grate surface (rawPressure) is what makes the shallow case
  // pay off immediately: rubble that has sunk into a pocket is below the pillar face and
  // stops pressing, whether or not it has left the shaft yet.
  //
  // Read from plateSolid, not from the match-3 grid, so the hole tracks the art rather than
  // the rules — see the note on plateSolid in the constructor.
  _solidAt(x, y) {
    if (y < this.originY) return false;             // above the wall: open shaft
    if (x < this.originX || x >= this.originX + this.boardW) {
      // Beside the board rather than over it. This is the stone ledge the grid is set into,
      // so it is solid floor: rubble that overhangs while the pillar is driven back rests on
      // it and rolls toward the grate, instead of falling through scenery and vanishing.
      return true;
    }
    if (y >= this.originY + this.boardH) return false;   // out the far side: falling away
    const c = Math.floor((x - this.originX) / this.cellW);
    const r = Math.floor((y - this.originY) / this.cellH);
    if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) return false;
    return this.plateSolid[r][c];
  }

  // The shaft's left wall follows the pillar as it moves. BOTH directions have to do something
  // to the mass, and only one of them used to.
  //
  // Retreating is the case that mattered and was missing, because it is the one the threat
  // feeds back through. Settled rock sleeps; a wall backing away from it wakes nothing, so the
  // pillar slid left and the pile stayed put, leaving a gap of a few px between them. The force
  // is sampled in a one-pack-cell strip at `bounds.left` — that strip travels with the pillar,
  // so it ended up measuring the gap instead of the rubble: load at the face fell 418 -> 20 and
  // rawPressure with it, 1.00 -> 0.07.
  //
  // Which made being pushed the thing that stopped the pushing. Measured hands-off: push rose
  // to 0.43 in ~7s and then sat there for the rest of the round, the stamina ring froze at just
  // over half, and the fail outcome was unreachable. With the wall pinned it fails at 15.7s, so
  // this was never CREEP_SECONDS vs RELIEF_SECONDS — those two constants were doing their job.
  //
  // wakeColumn, not a ratchet on push: a mass whose lateral support gives way should slump into
  // the space, and then the force is real again rather than being held up by arithmetic. Two
  // pack cells because one is the sample strip itself — the rock that has to move first is the
  // one just outside it.
  setLeftBound(x) {
    const b = this.sim.bounds;
    if (!b || x === b.left) return;
    if (x > b.left) this.sim.pushRightOf(x); // wall advancing: shove the mass, don't trap it
    else this.sim.wakeColumn(b.left, b.left + this.sim.packCell * 2); // retreating: let it slump
    b.left = x;
  }

  // Where new rubble enters. Driven from the layout so it is always just off the top of the
  // screen, whatever the viewport aspect — rubble should arrive from above the frame, not
  // materialise inside it.
  setSpawnY(y) {
    if (!this._inflowRect) return;
    this._inflowRect.y = y;
    this.sim.setInflow(this.sim.inflowRate, this._inflowRect);
  }

  // Where rubble stops existing. Also layout-driven, and below the frame rather than just
  // below the grate: rock that has poured through should fall out of sight, not wink out
  // in the middle of the picture.
  setDrainY(y) {
    this.sim.drainY = y;
  }

  // ---- build ----

  _buildBlocks() {
    this.blocks = [];
    this.blockAt = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) {
        const g = new PIXI.Graphics();
        const w = this.cellW * 0.96, h = this.cellH * 0.96;
        g.roundRect(-w / 2, -h / 2, w, h, w * 0.16).fill(0x8c7657);
        g.roundRect(-w / 2 + w * 0.08, -h / 2 + h * 0.08, w * 0.84, h * 0.3, w * 0.12)
          .fill({ color: 0xffffff, alpha: 0.1 });
        g.x = this.cellX(c);
        g.y = this.cellY(r);
        // Remembered because the crumble animates scale, and a plate that comes back on retry
        // has to come back at the size the layout gave it, not at 60% of it.
        g.baseScale = { x: g.scale.x, y: g.scale.y };
        this.blockLayer.addChild(g);
        this.blockAt[r][c] = g;
        this.blocks.push(g);
      }
  }

  _buildGems() {
    this.gemAt = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.allGems = [];
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) {
        const g = new PIXI.Graphics();
        g.circle(0, 0, this.cell * 0.31).fill(0xffffff);
        g.x = this.cellX(c);
        g.y = this.cellY(r);
        this.gemLayer.addChild(g);
        this.gemAt[r][c] = g;
        this.allGems.push(g);
      }
  }

  // Art arrives async and upgrades the flat stand-ins in place. Any slot that has no file
  // yet simply stays a vector shape, so the board is playable from the first frame with or
  // without art. See art.js for the file contract.
  async _loadArt() {
    // In COLORS order, and the same length — Match3 is built with COLORS.length colours, so a
    // fourth name here would hand out a texture index the rules can never produce.
    const gemNames = ['gem_blue_teardrop', 'gem_green_square', 'gem_red_heart'];
    const chipNames = ['plate_particle_0', 'plate_particle_1', 'plate_particle_2'];
    const plate = layer('plate_single');
    const gems = gemNames.map((n) => layer(n)).filter(Boolean);
    const chips = chipNames.map((n) => layer(n)).filter(Boolean);

    const [atlas] = await Promise.all([
      loadRockAtlas(),
      PIXI.Assets.load([plate?.url, ...gems.map((g) => g.url), ...chips.map((c) => c.url)].filter(Boolean)),
      this.shine.load(),
    ]);

    if (chips.length) this.chipTextures = chips.map((c) => PIXI.Texture.from(c.url));

    if (atlas) this.debris.setAtlas(atlas, this.cell * DRAW);
    if (plate) this.blockTexture = PIXI.Texture.from(plate.url);
    // One texture per gem, in COLORS order — the gems are different shapes, not tints, so
    // they cannot share a sheet frame the way a recoloured gem would.
    if (gems.length) {
      this.gemTextures = gems.map((g) => PIXI.Texture.from(g.url));
      this.gemSizes = gems.map((g) => ({ w: g.width, h: g.height }));
    }

    this._upgradeSprites();
  }

  // swap the Graphics stand-ins for textured sprites now that art exists
  _upgradeSprites() {
    if (this.blockTexture) {
      for (let r = 0; r < this.ROWS; r++)
        for (let c = 0; c < this.COLS; c++) {
          const old = this.blockAt[r][c];
          const s = new PIXI.Sprite(this.blockTexture);
          s.anchor.set(0.5);
          s.width = this.cellW;
          s.height = this.cellH;
          s.x = old.x; s.y = old.y; s.visible = old.visible;
          s.alpha = old.alpha;
          s.baseScale = { x: s.scale.x, y: s.scale.y };
          this.blockLayer.addChild(s);
          old.destroy();
          this.blockAt[r][c] = s;
        }
      this.blocks = this.blockAt.flat();
    }

    if (this.gemTextures) {
      let i = 0;
      const next = [];
      for (let r = 0; r < this.ROWS; r++)
        for (let c = 0; c < this.COLS; c++) {
          // `old` is null wherever a cell has already been cleared — art can finish loading
          // after the player's first match, and reading .x off that used to throw and leave
          // the board half-upgraded.
          const old = this.gemAt[r][c];
          const s = new PIXI.Sprite(this.gemTextures[0]);
          s.anchor.set(0.5);
          s.x = old?.x ?? this.cellX(c);
          s.y = old?.y ?? this.cellY(r);
          s.visible = old?.visible ?? false;
          this.gemLayer.addChild(s);
          old?.destroy();
          this.gemAt[r][c] = s;
          next[i++] = s;
        }
      this.allGems = next;
      this._syncAll();
    }
  }

  _applyGemLook(gem, colorIndex) {
    if (!gem) return;
    if (this.gemTextures) {
      const i = colorIndex % this.gemTextures.length;
      gem.texture = this.gemTextures[i];
      // The gems are distinct shapes (a heart is 43x40, a diamond 35x55), so they are fitted
      // to the cell by their longest side rather than squashed to a common box.
      const size = this.gemSizes[i];
      const k = (this.cell * 0.66) / Math.max(size.w, size.h);
      gem.width = size.w * k;
      gem.height = size.h * k;
      gem.tint = 0xffffff;
    } else {
      gem.tint = COLORS[colorIndex];
    }
  }

  _syncAll() {
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) {
        const v = this.logic.at(r, c);
        const gem = this.gemAt[r][c];
        const block = this.blockAt[r][c];
        if (gem) {
          gsap.killTweensOf(gem);
          gem.x = this.cellX(c);
          gem.y = this.cellY(r);
          gem.scale.set(1);
          gem.visible = v !== EMPTY;
          if (v !== EMPTY) this._applyGemLook(gem, v);
        }
        // An empty cell holds NO gem, not a hidden one. _settleWall reads occupancy off this
        // array, so a leftover sprite in a cleared cell would seal the hole back up.
        if (v === EMPTY) this.gemAt[r][c] = null;
        // The plate and its flag are set together, always: the wall the rubble falls through
        // and the wall on screen are the same wall.
        const standing = v !== EMPTY;
        this.plateSolid[r][c] = standing;
        if (block) {
          gsap.killTweensOf(block);
          gsap.killTweensOf(block.scale);
          const base = block.baseScale ?? { x: 1, y: 1 };
          block.scale.set(base.x, base.y);
          block.alpha = 1;
          block.visible = standing;
          // Plates travel now — they ride the collapse down with their gem — so a re-sync has
          // to put them back on their own cell, not just restore how they look.
          block.x = this.cellX(c);
          block.y = this.cellY(r);
        }
      }
  }

  get clearedFraction() { return this.logic.clearedFraction; }

  // How hard the rubble is bearing on the pillar, 0..1. This IS the threat: the pillar
  // position, the strain pose and the fail condition all read from it.
  //
  // It is the actual lateral force the mass exerts on the pillar face, summed down the force
  // chain — not a headcount of rocks. Rubble in real life pushes because it is stacked and
  // jammed, so a deep pile crushes and the same rocks spread thin do not.
  //
  // SMOOTHED, and that is not cosmetic. A contact force is genuinely spiky — it drops to zero
  // for a frame whenever the mass loses contact with the pillar face, which a headcount could
  // never do. Read raw, it made the pillar judder and, worse, tripped the win condition at
  // random moments. The physics stays raw; what the game reads is the settled value.
  get pressure() {
    return this._pressure;
  }

  // Where the pillar actually is, 0..1, and therefore how close he is to the spikes. The load
  // above drives this; it does not equal it. See CREEP_SECONDS.
  get push() {
    return this._push;
  }

  // Only the mass standing ON the grate presses on him. The pillar face runs from doc y 325 to
  // 561 and the grate starts at 544, so anything that has gone through the grate is below the
  // pillar entirely — it cannot push what it is no longer touching. Cutting the force off at
  // the grate surface is what makes the pillar ease back the moment the rubble starts pouring,
  // instead of a beat later when the rocks finally leave the frame.
  get rawPressure() {
    return Math.min(1, this.sim.wallForceLeft(0.45, this.originY) / CRUSH_FORCE);
  }

  // The whole outcome rule in one place: 'win' | 'fail' | null.
  //
  // It lives here rather than in game.js because the three signals it weighs — contact force,
  // how much rubble is left, and whether anything can still change — are all board state, and
  // splitting them across two files is how the stall rule came to hand out wins by accident.
  //
  // Guards, each of which exists because a force is a twitchier signal than a headcount:
  //   - `_armed`: the threat must have been real once, or the round is won in its first
  //     second, before the seeded mass has even reached the pillar.
  //   - `nearlyEmpty`: force alone reads low for a moment whenever the mass is out of
  //     contact, so the rubble has to actually be gone as well.
  //   - the stall rule resolves a position that can no longer change — but which way it
  //     resolves depends on whether he is still buried. It used to always say 'win', which
  //     meant getting stuck with a full shaft of rubble was rewarded.
  //   - and "can no longer change" has to include the BOARD, not just the rubble. The flow now
  //     closes on the first drained rock, seconds into the round, so "nothing is arriving and
  //     the pile has not shrunk for 2.5s" is just an ordinary pause between matches. Measured
  //     without the hasMove test: every round ended by stall at ~5s with the shaft still full.
  get outcome() {
    if (!this._started) return null;
    // Lost when the pillar has closed the gap, not when the load peaks. A momentary spike as
    // the mass lands is not a death; being held under that mass is.
    if (this.push >= 1) return 'fail';
    if (!this._armed) return null;

    const nearlyEmpty =
      this.sim.countAbove(this.threatLineY) <= this.capacity * WIN_ROCK_FRACTION;
    if (this.pressure <= WIN_AT && nearlyEmpty) return 'win';

    const stalled = this._inflowStopped
      && this._stallT >= STALL_SECONDS
      && !this.logic.hasMove();   // ordered last: it is the expensive test, and the rarest
    if (stalled) return nearlyEmpty ? 'win' : 'fail';
    return null;
  }

  // The threat clock only starts once the player is actually playing. What is left of the
  // round's fixed budget is handed to the sim here, so the flow can only ever deliver the
  // rubble the shaft was allotted — the rest of the game just decides how much of that
  // actually arrives before the drain opens.
  startInflow() {
    this._started = true;
    this._inflowStopped = false;
    this._lastAbove = Infinity;
    this._stallT = 0;
    this.sim.setInflow(this.inflowRate, null, Math.max(0, this.capacity - this._seededCount));
  }

  stopInflow() {
    this.sim.setInflow(0);
  }

  // Opening mass. Derived from capacity so the two can never drift apart — seeding more
  // rocks than capacity would put pressure at 1.0 before the player touches anything.
  seedRubble(count = Math.round(this.capacity * this.startFill)) {
    this._seededCount = count;
    this.sim.fill(count, {
      x: this.originX,
      y: this.originY - this.cell * 5,
      width: this.boardW,
      height: this.cell * 4,
    });
  }

  show() {
    this.root.visible = true;
    if (!this._seeded) { this.seedRubble(); this._seeded = true; }
  }

  hide() { this.root.visible = false; }

  // ---- input ----

  _bindInput() {
    this.root.eventMode = 'static';
    // Only the board takes input. It used to claim the whole screen, which would now swallow
    // taps meant for the HUD buttons sitting above it.
    const pad = this.cell * 0.5;
    this.root.hitArea = new PIXI.Rectangle(
      this.originX - pad, this.originY - pad,
      this.boardW + pad * 2, this.boardH + pad * 2,
    );
    this._onDown = (e) => this._pointerDown(e);
    this._onMove = (e) => this._pointerMove(e);
    this._onUp = () => (this.drag = null);
    this.root.on('pointerdown', this._onDown);
    this.root.on('globalpointermove', this._onMove);
    this.root.on('pointerup', this._onUp);
    this.root.on('pointerupoutside', this._onUp);
  }

  _pointerDown(e) {
    if (!this.enabled || this.busy) return;
    const p = e.getLocalPosition(this.root);
    const cell = this.cellAtPoint(p.x, p.y);
    if (cell && !this.logic.isEmpty(cell.r, cell.c)) this.drag = cell;
  }

  _pointerMove(e) {
    if (!this.drag || !this.enabled || this.busy) return;
    const p = e.getLocalPosition(this.root);
    const cell = this.cellAtPoint(p.x, p.y);
    if (!cell) return;
    if (Math.abs(cell.r - this.drag.r) + Math.abs(cell.c - this.drag.c) !== 1) return;
    const from = this.drag;
    this.drag = null;
    this._attemptSwap(from, cell);
  }

  // ---- swap + cascade ----

  _attemptSwap(a, b) {
    if (this.busy) return;
    this.busy = true;
    this.hideHint();

    const steps = this.logic.trySwap(a.r, a.c, b.r, b.c);
    this.onSwap?.(!!steps);
    if (!steps) {
      this._animateSwap(a, b, () => this._animateSwap(b, a, () => { this.busy = false; }));
      return;
    }
    if (!this.movedOnce) { this.movedOnce = true; this.onFirstMove?.(); }
    this._animateSwap(a, b, () => this._playSteps(steps, 0));
  }

  _animateSwap(a, b, done) {
    const ga = this.gemAt[a.r][a.c];
    const gb = this.gemAt[b.r][b.c];
    this.gemAt[a.r][a.c] = gb;
    this.gemAt[b.r][b.c] = ga;
    if (ga) gsap.to(ga, { x: this.cellX(b.c), y: this.cellY(b.r), duration: T_SWAP, ease: 'power1.inOut' });
    if (gb) gsap.to(gb, { x: this.cellX(a.c), y: this.cellY(a.r), duration: T_SWAP, ease: 'power1.inOut', onComplete: done });
    else done?.();
  }

  _playSteps(steps, i) {
    if (i >= steps.length) {
      if (this.logic.ensurePlayable()) this._syncColors();
      this.busy = false;
      return;
    }
    const step = steps[i];

    for (const { r, c } of step.cleared) {
      // Fires off the cell, not off the gem sprite, so it still plays on a cell whose gem is
      // missing — art can finish loading mid-cascade and leave gemAt holes behind it. The
      // sparkles stagger themselves from here, trailing the chips that follow at T_CLEAR.
      this.shine.burst(this.cellX(c), this.cellY(r));
      const gem = this.gemAt[r][c];
      this.gemAt[r][c] = null;
      if (!gem) continue;
      const sx = gem.width, sy = gem.height;
      gsap.to(gem, {
        width: 0, height: 0, duration: T_CLEAR, ease: 'back.in(2)',
        onComplete: () => { gem.visible = false; gem.width = sx; gem.height = sy; },
      });
    }
    this.onClear?.(step.cleared.length, i); // i = cascade depth

    // Gem, then the plate under it, then the wall settling into the gap. Three beats, in the
    // order the player would expect them physically — the stone cannot fall before it breaks.
    gsap.delayedCall(T_CLEAR, () => {
      for (const { r, c, color } of step.cleared) this._removePlate(r, c, color);
      gsap.delayedCall(T_PLATE, () => {
        this._applyFall(step.fell, () => this._playSteps(steps, i + 1));
      });
    });
  }

  // The column settles: every survivor above a cleared cell drops, plate and gem together,
  // and the gap ends up at the top of the column where the rubble is waiting.
  //
  // The arrays are re-mapped immediately and the sprites tween to catch up — the grid is the
  // truth. Plates are SWAPPED rather than overwritten: the destination cell is holding the
  // crumbled, hidden plate, and parking that sprite in the vacated cell keeps every cell
  // holding exactly one plate sprite, which is what reset() and the art upgrade both assume.
  //
  // plateSolid is deliberately NOT touched until the drop lands. Until then it still reports
  // the pre-fall wall, which claims solid where the plate is currently passing through — the
  // conservative answer, and the true one.
  _applyFall(fell, done) {
    if (!fell?.length) { done(); return; }

    for (const { from, to } of fell) {
      const gem = this.gemAt[from.r][from.c];
      const block = this.blockAt[from.r][from.c];
      const spent = this.blockAt[to.r][to.c];

      this.gemAt[to.r][to.c] = gem;
      this.gemAt[from.r][from.c] = null;
      this.blockAt[to.r][to.c] = block;
      this.blockAt[from.r][from.c] = spent;
      if (spent) {
        // Park the crumbled plate in the cell the hole has moved to. Hidden explicitly rather
        // than trusting the crumble's own timer to have fired first — they land on the same
        // frame, and a plate that reappears at the top of the column is very visible.
        gsap.killTweensOf(spent);
        spent.visible = false;
        spent.y = this.cellY(from.r);
      }

      const y = this.cellY(to.r);
      // Eased in, not out: it is masonry dropping, so it should arrive hard.
      if (gem) gsap.to(gem, { y, duration: T_DROP, ease: 'power1.in' });
      if (block) gsap.to(block, { y, duration: T_DROP, ease: 'power1.in' });
    }
    this.blocks = this.blockAt.flat();

    this._plateCalls.push(gsap.delayedCall(T_DROP, () => {
      this._settleWall(fell);
      done();
    }));
  }

  // Re-read the wall once the drop has landed, and wake the rubble over every column that
  // moved. One recompute rather than per-cell bookkeeping: after a collapse the whole column
  // has shifted, and reconstructing that from the move list is a way to be subtly wrong about
  // which cells are open.
  //
  // READ FROM gemAt, NOT FROM this.logic. The rules run the ENTIRE cascade the instant the
  // swap is made — resolve() returns a finished board and a list of steps to animate — so the
  // grid is already at the end state while the view is still on step 0. Reading it here jumped
  // the wall to the final layout mid-cascade, and the plates cleared by later steps were then
  // skipped by _removePlate (its `already open?` guard was true before their turn came), which
  // left plates standing on screen over cells the board considered empty. gemAt is the view's
  // own state: nulled when a gem is cleared, moved when it falls, and always exactly as far
  // through the cascade as the player is.
  _settleWall(fell) {
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) this.plateSolid[r][c] = this.gemAt[r][c] != null;

    const columns = new Set(fell.map(({ to }) => to.c));
    for (const c of columns) {
      this.sim.wakeColumn(this.originX + c * this.cellW, this.originX + (c + 1) * this.cellW);
    }
  }

  // Stone chips thrown off a cleared cell. Pooled and recycled — a cascade can clear a dozen
  // cells at once, and allocating sprites per match is the kind of thing that shows up as a
  // hitch exactly when the game is at its busiest.
  _burst(x, y, color) {
    if (!this.chipTextures) return;
    // Grit, not gravel: a handful of small chips scatter wider than three big ones for the same
    // amount of ink, and the cell is only ~60px across — chips that read as individual rocks
    // compete with the rubble, which is the thing on screen that is supposed to be made of rocks.
    const tint = CHIP_TINTS[color] ?? 0xffffff;

    // Decided ONCE per burst and shared by every chip in it. This is the half that was missing:
    // each chip already picked its own angle, size, spin and duration, but every burst threw
    // the same number of pieces, out of the same point, in a fan symmetric about straight up.
    // The eye reads the silhouette of the whole spray before it reads any single piece, so the
    // bursts went on looking stamped no matter how much the pieces varied inside them.
    const count = CHIP_MIN + ((Math.random() * (CHIP_VAR + 1)) | 0);
    const lean = (Math.random() - 0.5) * CHIP_LEAN;

    for (let i = 0; i < count; i++) {
      const s = this.chipPool.pop() ?? this._newChip();
      gsap.killTweensOf(s);
      s.texture = this.chipTextures[(Math.random() * this.chipTextures.length) | 0];
      // Shown by onStart instead of here: a chip with a launch delay would otherwise sit
      // motionless at its spawn point for those few frames.
      s.visible = false;
      s.alpha = 1;
      s.tint = tint;

      // Chips leave from across the face of the plate rather than from one pixel at its
      // centre. A true radial fan from a single point is a firework; this is a slab of stone
      // coming apart, and the pieces start where they already were.
      const ox = (Math.random() - 0.5) * this.cellW * CHIP_SPAWN_AREA;
      const oy = (Math.random() - 0.5) * this.cellH * CHIP_SPAWN_AREA;
      s.position.set(x + ox, y + oy);

      // Size varies per chip, not just per texture. The three source sprites are already
      // different shapes (46x33, 16x21, 42x39), but drawing all of them at one scale made a
      // burst read as the same three pieces repeating.
      s.scale.set(this.cell * CHIP_SCALE * (CHIP_SIZE_MIN + Math.random() * CHIP_SIZE_VAR));
      s.rotation = Math.random() * Math.PI * 2;

      // A launch velocity and a gravity, rather than a destination. The chip is a thrown
      // object now: where it ends up is whatever the maths says, which is what makes the
      // pieces fall instead of sliding to a stop.
      const ang = -Math.PI / 2 + lean + (Math.random() - 0.5) * 2.8;
      const speed = this.cell * (CHIP_SPEED_MIN + Math.random() * CHIP_SPEED_VAR);
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed; // negative is upward — screen coords
      const g = this.cell * CHIP_GRAVITY;
      const life = CHIP_LIFE_MIN + Math.random() * CHIP_LIFE_VAR;

      // Stone does not all let go on one frame. Small enough to stay part of the same impact,
      // big enough that the spray unfolds instead of appearing whole.
      const delay = Math.random() * CHIP_STAGGER;

      // THE TWO AXES MUST NOT SHARE AN EASE. They used to — x and y both ran power1.out from
      // spawn to a fixed destination — and two identical eases interpolate a straight line, so
      // every chip slid along a diagonal and the burst had no arc in it at all. Adding a
      // downward offset to the destination only tilted the line.
      //
      // Horizontal is linear: nothing meaningful slows a stone chip over 60 px of air.
      gsap.to(s, {
        x: s.x + vx * life,
        duration: life,
        delay,
        ease: 'none',
        onStart: () => { s.visible = true; },
      });

      // Vertical is quadratic, in two halves: decelerating up to the apex, then accelerating
      // down. power2 IS the constant-acceleration curve, so this traces a real parabola rather
      // than something shaped like one. A chip thrown flat or downward has no rise at all and
      // skips straight to the fall.
      const apexT = Math.min(Math.max(-vy / g, 0), life);
      const yAt = (t) => s.y + vy * t + 0.5 * g * t * t;
      if (apexT > 0.02) {
        gsap.to(s, { y: yAt(apexT), duration: apexT, delay, ease: 'power2.out' });
        gsap.to(s, {
          y: yAt(life), duration: life - apexT, delay: delay + apexT, ease: 'power2.in',
        });
      } else {
        gsap.to(s, { y: yAt(life), duration: life, delay, ease: 'power2.in' });
      }

      // Constant spin — a tumbling chip has no reason to slow down mid-air.
      gsap.to(s, {
        rotation: s.rotation + (Math.random() - 0.5) * 5,
        duration: life,
        delay,
        ease: 'none',
      });

      // Fades late rather than evenly, so the chip is still solid through the part of the arc
      // that turns over. Fading it flat hid the very motion this change is for.
      gsap.to(s, {
        alpha: 0,
        duration: life,
        delay,
        ease: 'power2.in',
        onComplete: () => { s.visible = false; this.chipPool.push(s); },
      });
    }
  }

  _newChip() {
    const s = new PIXI.Sprite(this.chipTextures[0]);
    s.anchor.set(0.5);
    this.fxLayer.addChild(s);
    return s;
  }

  // A plate stands exactly while its cell holds a gem. Nothing moves it — with the match-3
  // gravity gone, a cell empties only where the player matched, so the wall erodes in the
  // shape they cut into it. Plates are never simulated; they stop existing and the rubble
  // re-tests its footing.
  // Take one plate out of the wall.
  //
  // ORDER MATTERS, and getting it wrong is what made the rubble drain through plates that
  // were still on screen: the rules empty the cell the instant the swap resolves, but the
  // gem still has to shrink and the plate still has to come apart. The hole is opened by the
  // delayedCall below — on the last frame of the crumble — so what the simulation is falling
  // through is always what the player can see is gone.
  _removePlate(r, c, color) {
    if (!this.plateSolid[r][c]) return;

    // Chips fly on the frame the STONE breaks, not the frame the gem pops — but they carry the
    // gem's colour, so the burst reads as "that colour just paid off" rather than as generic
    // debris. The gem itself is gone by now (T_CLEAR earlier), so the colour has to be handed
    // down from the cascade step; it cannot be read back off the board.
    this._burst(this.cellX(c), this.cellY(r), color);

    const block = this.blockAt[r][c];
    if (block) {
      gsap.killTweensOf(block);
      gsap.killTweensOf(block.scale);
      const base = block.baseScale ?? { x: 1, y: 1 };
      gsap.to(block, { alpha: 0, duration: T_PLATE, ease: 'power1.in' });
      gsap.to(block.scale, {
        x: base.x * 0.55, y: base.y * 0.55, duration: T_PLATE, ease: 'back.in(2)',
      });
    }

    // Timed rather than hung off the tween's onComplete: the art loader can swap this very
    // sprite out from under us mid-crumble, and the hole must open regardless.
    this._plateCalls.push(gsap.delayedCall(T_PLATE, () => {
      const b = this.blockAt[r][c];
      if (b) b.visible = false;
      this.plateSolid[r][c] = false;

      // Shake loose the rubble sitting on this plate; the avalanche propagates upward
      // through the mass on its own from there.
      this.sim.disturb(this.cellX(c), this.cellY(r), this.cell * 1.2);
      // And tell the column above it. A hole four rows down is a change far below the pile —
      // a radius around it reaches nothing, so the mass would go on resting on a wall that
      // is no longer there.
      this.sim.wakeColumn(this.originX + c * this.cellW, this.originX + (c + 1) * this.cellW);
    }));
  }

  _syncColors() {
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) {
        const v = this.logic.at(r, c);
        if (v !== EMPTY) this._applyGemLook(this.gemAt[r][c], v);
      }
  }

  update(dt) {
    // ONCE IT IS DRAINING, NOTHING MORE ARRIVES. The first rock through the grate is the
    // turning point of the round: up to it the player is losing ground, after it the mass can
    // only shrink. Tying it to the drain rather than to a board-clear percentage is what makes
    // the amount of rubble a fixed, finite thing the player can be ahead or behind of.
    //
    // The budget running dry stops it too — a player who never opens a hole still only ever
    // gets the shaft filled once — and either way the flag is what tells the stall rule that
    // the position can no longer change.
    if (this._started && !this._inflowStopped &&
        (this.sim.drained > 0 || this.sim.inflowLeft <= 0)) {
      this._inflowStopped = true;
      this.stopInflow();
      this.onInflowEnd?.();
    }

    this.sim.update(dt);
    this.debris.sync();

    // Settle the raw contact force into what the game reads.
    this._pressure += (this.rawPressure - this._pressure) * Math.min(1, dt * PRESSURE_LAG);
    if (this._pressure >= ARM_AT) this._armed = true;

    // And let that load work on him over time. Pressure is what the rubble weighs; push is how
    // far it has moved him, and it only moves while the mass is actually bearing down.
    if (this._started) {
      if (this._pressure > CREEP_AT) {
        this._push = Math.min(1, this._push + (this._pressure * dt) / CREEP_SECONDS);
      } else {
        this._push = Math.max(0, this._push - dt / RELIEF_SECONDS);
      }
    }

    // Rubble actually leaving the shaft, reported in batches. Per rock it would machine-gun —
    // a column flushes dozens in a second — so it fires once a real quantity has gone and then
    // holds off, which is also how it sounds: one pour, not fifty pebbles.
    this._drainHold = Math.max(0, this._drainHold - dt);
    const gone = this.sim.drained - this._lastDrained;
    if (gone >= DRAIN_BATCH && this._drainHold === 0) {
      this._lastDrained = this.sim.drained;
      this._drainHold = DRAIN_HOLD;
      this.onDrain?.(gone);
    }

    // Stall detection for the win condition above. Any progress at all resets the clock.
    if (this._started) {
      const above = this.sim.countAbove(this.threatLineY);
      if (above < this._lastAbove) {
        this._lastAbove = above;
        this._stallT = 0;
      } else {
        this._stallT += dt;
      }
    }
  }

  // ---- hint / tutorial ----

  hintCells() {
    const h = this.logic.findHint();
    return h ? [h.a, h.b] : [];
  }

  showHint() {
    this.hideHint();
    this._hintTweens = this.hintCells()
      .map((p) => this.gemAt[p.r]?.[p.c])
      .filter(Boolean)
      .map((gem) => gsap.to(gem.scale, {
        x: 1.2, y: 1.2, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut',
      }));
  }

  hideHint() {
    if (!this._hintTweens) return;
    for (const t of this._hintTweens) {
      const target = t.targets()[0];
      t.kill();
      target?.set?.(1);
    }
    this._hintTweens = null;
  }

  reset() {
    this.hideHint();
    this.busy = false;
    this.movedOnce = false;
    this.drag = null;
    for (const g of this.allGems) gsap.killTweensOf(g);
    // A retry can land mid-cascade, with plates still coming apart. Those crumbles must not
    // outlive the board they belong to and punch holes in the fresh one.
    for (const call of this._plateCalls) call.kill();
    this._plateCalls.length = 0;
    // Same reasoning for the shine: its sparkles are staggered, so a retry can land with some
    // of them not yet spawned and they would twinkle over the rebuilt board.
    this.shine.reset();
    this.logic.reset();
    this.sim.reset();
    this.stopInflow();
    this._seeded = false;
    this._started = false;
    this._inflowStopped = false;
    this._lastAbove = Infinity;
    this._stallT = 0;
    this._pressure = 0;
    this._push = 0;
    this._armed = false;
    this._seededCount = 0;
    this._lastDrained = 0;
    this._drainHold = 0;

    let i = 0;
    this.gemAt = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) this.gemAt[r][c] = this.allGems[i++];

    this._syncAll();
    this.show();
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
