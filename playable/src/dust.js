// Dust kicked up under his feet when he lands.
//
// One soft 128px puff drawn a dozen times, not a sprite sheet. The animated 4x4 smoke grid this
// replaced was 333 KB and would have been ~440 KB inlined, for an effect on screen for half a second
// at the very start — the same trade chest.js made when it dropped its sheet for a tween. What a
// billow actually needs is to spread, swell and thin out, and all three of those are transforms.
//
// Hand-integrated like confetti.js rather than tweened, and for the same reason: there is no
// destination here. It is thrown out sideways by a man hitting the floor, air stops it almost
// immediately, and where it ends up is whatever falls out of that.
//
// It is DUST, not smoke, so it does not rise and drift — the difference is the drag. Smoke is
// lighter than air and keeps going; grit thrown off a stone floor is heavier, so it is stopped
// within its own body length and then just hangs and fades. DRAG is what makes it read as one
// rather than the other, and it is the first knob to reach for if this ever looks like steam.
import * as PIXI from 'pixi.js';
import { VFX_SMOKE_URL } from './layers.js';

const COUNT = 14;

// Where the puffs start, relative to his feet: spread along the ground under him, and lifted
// clear of the floor line so none of them is born half-buried in it.
const SPREAD = 30;
const LIFT = 8;

// Thrown outward, away from the point of impact. Mostly sideways with some rise — he displaces
// the air downward and it has nowhere to go but out.
const SPEED_MIN = 110;   // document units/s
const SPEED_VAR = 210;
const RISE_MIN = 25;
const RISE_VAR = 95;

// Per second, on both axes. High, and that is the point — see the header. At 3.4 a puff travels
// its speed/DRAG, so 32 to 94 units: it spills out to about the width of him and stops.
const DRAG = 3.4;

// Launch size in document units, against a hero ~118 wide, and how far each swells over its life.
// A puff that holds its size while it fades reads as a decal being turned down.
const SIZE_MIN = 30;
const SIZE_VAR = 44;
const GROWTH = 1.9;

const LIFE_MIN = 0.5;
const LIFE_VAR = 0.45;
// Snapped on rather than faded in — the impact is instantaneous, and dust that ramps up looks
// like it was already there. Only the dying half is eased.
const ALPHA = 0.55;

// The dust is the same stone the debris is, so it takes the debris's colour rather than a grey of
// its own. The rock sheets average 0x917e6a and DebrisRenderer's palette only ever multiplies
// that DOWN (its tint is a MULTIPLY — see the note in debris_pixi.js), so the mean rock on screen
// is a little darker again. These three bracket it: the stone, and one step either side.
//
// Three rather than one for exactly the reason the debris carries four — a mass of identically
// coloured puffs reads as one sprite repeated, which is the thing the eye picks out first.
const TINT = [0x9c8975, 0x917e6a, 0x7d6c5b];

export class Dust {
  constructor({ parent }) {
    this.puffs = [];
    this.pool = [];
    this.texture = null;
    this.layer = new PIXI.Container();
    parent.addChild(this.layer);
  }

  // Fail-soft, the same contract as the rest of the art path: no texture means no dust and the
  // caller does not have to check.
  async load() {
    if (!VFX_SMOKE_URL) return null;
    try {
      await PIXI.Assets.load(VFX_SMOKE_URL);
      this.texture = PIXI.Texture.from(VFX_SMOKE_URL);
    } catch (e) {
      console.warn('[dust] texture failed to load — the landing plays without it', e);
    }
    return this.texture;
  }

  // x is where he came down, groundY his floor line — both in the parent's space.
  burst(x, groundY) {
    if (!this.texture) return;
    for (let i = 0; i < COUNT; i++) this._one(x, groundY);
  }

  _one(x, groundY) {
    const s = this.pool.pop() ?? this._create();
    s.visible = true;
    s.alpha = ALPHA;
    s.tint = TINT[(Math.random() * TINT.length) | 0];
    // Random attitude per puff. The art is a soft blob with no up, so this costs nothing and
    // stops the repeats from lining up.
    s.rotation = Math.random() * Math.PI * 2;

    const size = SIZE_MIN + Math.random() * SIZE_VAR;
    s.width = size;
    s.height = size;

    // Which way out. Signed from where it was born rather than randomly, so the two halves of
    // the cloud genuinely part from the point of impact instead of crossing through it.
    const off = (Math.random() * 2 - 1) * SPREAD;
    s.x = x + off;
    s.y = groundY - LIFT - Math.random() * LIFT;
    const dir = off === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(off);

    this.puffs.push({
      s,
      size,
      vx: dir * (SPEED_MIN + Math.random() * SPEED_VAR),
      vy: -(RISE_MIN + Math.random() * RISE_VAR),
      life: LIFE_MIN + Math.random() * LIFE_VAR,
      t: 0,
    });
  }

  _create() {
    const s = new PIXI.Sprite(this.texture);
    s.anchor.set(0.5);
    this.layer.addChild(s);
    return s;
  }

  update(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      if (p.t >= p.life) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.puffs.splice(i, 1);
        continue;
      }

      const k = p.t / p.life;
      const d = 1 - DRAG * dt;
      p.vx *= d;
      p.vy *= d;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;

      // Swell and thin together. The fade is squared so it holds its body through the first half
      // of the spread and then goes quickly, rather than being half gone before it has moved.
      const size = p.size * (1 + (GROWTH - 1) * k);
      p.s.width = size;
      p.s.height = size;
      p.s.alpha = ALPHA * (1 - k) * (1 - k);
    }
  }

  reset() {
    for (const p of this.puffs) { p.s.visible = false; this.pool.push(p.s); }
    this.puffs.length = 0;
  }
}
