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
    this.pillar.x = this._pillarHomeX - this.push * PILLAR_TRAVEL;
  }

  // The hero is braced against the pillar, so he rides the same offset.
  get pushOffset() { return -this.push * PILLAR_TRAVEL; }

  // The face the rubble bears against. The debris shaft is bounded by this rather than by the
  // board edge, so the mass stays in contact with the pillar as it is driven back — otherwise
  // a strip of empty space opens between them and the rubble stops looking like the cause.
  get pillarRight() { return this.pillar.x + this.pillar.width; }

  // Win beat one: the mass is gone, so the pillar springs back off the hero.
  releasePillar() {
    return gsap.to(this.pillar, {
      x: this._pillarHomeX + 18,
      duration: 0.75,
      ease: 'elastic.out(1, 0.55)',
    });
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
