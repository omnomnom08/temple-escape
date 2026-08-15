// Rubble simulation — pure maths, no renderer.
//
// Same split as match3.js: the rules live here, the drawing lives in debris_pixi.js.
// Nothing here knows about Pixi or Three, so it can be unit-tested headlessly and
// survives any rendering decision.
//
// The rocks are a granular mass held back by the block wall. They rest against solid
// cells and pour through whatever holes a match opens, then drain away.
//
// Coordinates are Pixi convention: +X right, +Y DOWN. Gravity is +Y.
//
// WHY IT LOOKS ALIVE (this is the part worth understanding):
//
//   1. AVALANCHE. Every live rock occupies a cell in a sparse grid. When a rock leaves a
//      cell, anything resting on it that has lost its footing is woken, and they wake
//      theirs in turn. Open a hole at the bottom and the whole column above cascades —
//      the single thing that separates flowing rubble from a dead heap.
//   2. SETTLING, NOT FREEZING. Contact doesn't stop a rock; it has to be genuinely
//      still for `settleTime` before it sleeps. Rocks jostle into place.
//   3. ROLLING. A rock that can't go straight down but has an opening diagonally
//      converts its fall into lateral flow instead of discarding it, so heaps slump
//      to a natural angle of repose and rubble finds a hole several cells away.
//
// Collision is axis-separated against a grid lookup — no solver, no broadphase.
//
// Frame/rotation tuning: 13-frame tumble loop, spin ~24fps, rotation quantised to 10° at
// 12fps. Quantising is deliberate — continuous rotation on a low-frame tumble reads as
// sliding rather than tumbling.

export const ROCK_FRAMES = 13;
export const ROCK_TYPES = 4;

const SPIN_FPS = 24;
const ANGLE_FPS = 12;
const ANGLE_STEP = Math.PI / 18;      // 10°
const FIXED_DT = 0.02;                // 50 Hz, as shipped by the reference
const TYPE_WEIGHTS = [28, 28, 15, 29];

export class DebrisSim {
  constructor({
    max = 300,
    gravity = 2000,          // px/s²
    freezeSpeed = 3,         // px/s — below this a resting rock counts as still
    settleTime = 0.18,       // s of stillness before a rock is allowed to sleep
    groundFriction = 0.80,   // lateral damping while resting on something
    bounce = 0.18,           // fraction of impact speed kept as a jostle
    flowSpeed = 400,         // px/s downward to count as "pouring"
    flowMinCount = 10,
    flowCooldown = 0.7,
    flowStartupIgnore = 0.6,
    maxFall = null,          // terminal velocity, px/s. Defaults to 0.85 x gravity.
    drainY = Infinity,       // past this a rock has escaped
    solidAt = null,          // (x, y) => is that cell still a solid block?
    bounds = null,           // { left, right } — the shaft walls. See _blocked().
    packCell = 0,            // >0 enables rock-vs-rock contact at this grid size
    onFlow = null,
  } = {}) {
    Object.assign(this, {
      max, gravity, freezeSpeed, settleTime, groundFriction, bounce,
      flowSpeed, flowMinCount, flowCooldown, flowStartupIgnore,
      drainY, solidAt, bounds, packCell, onFlow,
    });

    this.slideAccel = gravity * 0.9;      // how eagerly a rock rolls off a heap
    this.maxContactT = settleTime * 12;   // termination guarantee: no perpetual jostling

    // Terminal velocity. This used to be derived from the pack grid — a rock could not travel
    // further in one step than a cell is wide, or it tunnelled straight through. That made
    // fall speed a hostage of packing: tightening the grid to close the visual gaps silently
    // dropped terminal velocity by 25% and the rubble started to feel weightless.
    //
    // Movement is substepped now (see _moveAxis), so tunnelling is handled by splitting the
    // motion rather than by capping it, and this is a real physical parameter again.
    this.maxFall = maxFall ?? gravity * 0.85;
    this.subStep = packCell > 0 ? packCell * 0.5 : Infinity;

    // Sparse occupancy: cell key -> the rocks standing in it. EVERY live rock is in exactly
    // one cell, moving or not, so a falling rock is a real obstacle to the one above it.
    //
    // A cell holds a LIST rather than a single rock. Rocks are drawn wider than a cell on
    // purpose (see PACK/DRAW in board2d), so they overlap and two can legitimately round into
    // the same cell — via spawning, or a wall shoving them together. A one-rock map could not
    // represent that: the loser was dropped from the grid and silently stopped colliding, so
    // roughly 5% of the mass became scenery other rocks fell straight through.
    this._occ = new Map();

    this.parts = Array.from({ length: max }, () => ({
      alive: false, asleep: true,
      x: 0, y: 0, vx: 0, vy: 0,
      cell: null, stillT: 0, contactT: 0, load: 1,
      // Both 0 unless a caller sets them, which means "use the palette" — the sim does not know
      // what a colour is, it only carries the two numbers through to whatever draws the rock.
      // The pillar's debris is the only thing that sets them; see Board2D.collapsePillar.
      tint: 0, glow: 0,
      type: 0, frame: 0, frameT: 0,
      angle: 0, drawAngle: 0, angleT: 0, age: 0,
    }));
    this.live = 0;
    this.drained = 0;
    this._next = 0;
    this._acc = 0;
    this._flowCooldownT = 0;

    this.inflowRate = 0;      // rocks/sec — the threat clock
    this.inflowRect = null;
    this._inflowAcc = 0;
    // How many rocks are still owed to the shaft. The round has a FIXED quantity of rubble in
    // it, not a tap that runs until some other rule closes it, so the budget lives with the
    // thing that spawns rather than in a caller that has to remember to stop it.
    // Unbounded until someone sets one — a rate with no budget means "keep raining", which is
    // what a caller that has never heard of budgets expects.
    this.inflowLeft = Infinity;

    this._cum = [];
    let acc = 0;
    for (const w of TYPE_WEIGHTS) { acc += w; this._cum.push(acc); }
    this._cumTotal = acc;
  }

  // ---------------- occupancy ----------------

  _gx(x) { return Math.round(x / this.packCell); }
  _gy(y) { return Math.round(y / this.packCell); }
  _keyAt(x, y) { return `${this._gx(x)},${this._gy(y)}`; }

  // Remove a rock from the cell it is registered in, dropping the cell when it empties.
  _release(p) {
    const list = this._occ.get(p.cell);
    if (!list) return;
    const i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this._occ.delete(p.cell);
  }

  // Move a rock's registration to the cell it is actually standing in.
  //
  // Every LIVE rock is registered, not just the sleeping ones. That is the whole fix for the
  // settling artefact: when only sleepers occupied cells, falling rocks passed straight
  // through each other, landed in an overlapping heap, and were then teleported one at a time
  // onto free cells as they fell asleep — which is why the pile rearranged itself a second
  // after landing and settled into a lattice full of holes instead of a heap.
  _reindex(p) {
    if (this.packCell <= 0) return;
    const key = this._keyAt(p.x, p.y);
    if (key === p.cell) return;

    const from = p.cell;
    if (from) this._release(p);

    p.cell = key;
    const list = this._occ.get(key);
    if (list) list.push(p);
    else this._occ.set(key, [p]);

    // Whatever was resting on the cell just left may have lost its footing.
    if (from) this._wakeAround(from);
  }

  // Advance one axis, in steps no larger than half a pack cell so a fast rock cannot jump
  // over an obstacle. Returns true if it hit something and stopped short.
  //
  // Substepping is what lets terminal velocity be a physical choice rather than whatever the
  // pack grid allows. A rock falling at 1400 px/s covers 28px in a 50Hz step, which is more
  // than a cell — without this it would pass straight through the pile and settle inside it.
  _moveAxis(p, delta, horizontal) {
    if (delta === 0) return false;
    const sign = delta < 0 ? -1 : 1;
    let remaining = Math.abs(delta);

    while (remaining > 1e-6) {
      const step = Math.min(remaining, this.subStep) * sign;
      const prev = horizontal ? p.x : p.y;
      if (horizontal) p.x += step; else p.y += step;

      if (this._blocked(p.x, p.y, p)) {
        if (horizontal) p.x = prev; else p.y = prev;
        return true;
      }
      remaining -= Math.abs(step);
    }
    return false;
  }

  // Is anything directly beneath this rock still holding it up?
  _supported(p) {
    return this._blocked(p.x, p.y + this.packCell, p);
  }

  // Can this rock still move? Not just "is something under it" — a rock perched on the side
  // of a heap is supported from below and yet must obviously slide, which is what gives a
  // pile its angle of repose. Unstable means: nothing underneath, OR a diagonal opening it
  // can roll into.
  _stable(p) {
    if (!this._supported(p)) return false;
    const s = this.packCell;
    const leftOpen = !this._blocked(p.x - s, p.y + s, p) && !this._blocked(p.x - s, p.y, p);
    const rightOpen = !this._blocked(p.x + s, p.y + s, p) && !this._blocked(p.x + s, p.y, p);
    return !(leftOpen || rightOpen);
  }

  // Wake the neighbours resting on a cell that was just vacated — but only the ones that
  // have actually lost their footing.
  //
  // The support check is what makes this safe to call on EVERY cell change. Waking
  // unconditionally kept the pile churning and it never came to rest; waking only when the
  // vacating rock moved downward was the opposite error, since a supporter sliding sideways
  // removes support just as surely, and left the occasional rock stranded in mid-air.
  // Wake the sleepers around a cell that was just vacated — the ones that can now move.
  //
  // This used to look only at the row ABOVE, which is why rubble draining down a column left
  // vertical walls standing beside the channel: the rock next to the hole had not lost what
  // was under it, so nothing ever woke it, and it stood there like masonry. Real rubble
  // slumps sideways into a channel. Checking `_stable` rather than `_supported` is what makes
  // that happen, and checking the row beside as well as above is what lets it start.
  _wakeAround(key) {
    const comma = key.indexOf(',');
    const cx = +key.slice(0, comma);
    const cy = +key.slice(comma + 1);
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const list = this._occ.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const q of list) {
          if (!q.asleep || this._stable(q)) continue;
          q.asleep = false;
          q.stillT = 0;
          q.contactT = 0;
        }
      }
    }
  }

  // The shaft walls. Without these the rubble has no lateral bound at all: solidAt only
  // answers for cells inside the match grid and reports open space everywhere else, so a
  // rock that drifted off the edge of the board fell past the painted walls forever.
  _outOfBounds(x) {
    return !!this.bounds && (x < this.bounds.left || x > this.bounds.right);
  }

  _blocked(x, y, self = null) {
    if (this._outOfBounds(x)) return true;
    // `self` is handed to solidAt as well as used below: the wall is allowed to answer
    // differently for a rock that has already got past it — a grate is a surface, not a
    // solid block, so what has gone through a hole keeps going. See board2d._solidAt.
    if (this.solidAt && this.solidAt(x, y, self)) return true;
    if (this.packCell > 0) {
      const key = this._keyAt(x, y);
      // A rock is never blocked by its OWN cell. Excluding just `self` from the occupant
      // list is not enough now that a cell can hold several: rocks sharing a cell are
      // already overlapping, so treating each other as obstacles freezes all of them in
      // place permanently — they cannot even move within the cell they are standing in.
      if (self && key === self.cell) return false;
      if (this._occ.has(key)) return true;
    }
    return false;
  }

  // A rock leaves the grid entirely: drained, or its pool slot is being recycled.
  //
  // This used to carry its own avalanche walk, unregistering whole columns and waking them
  // without checking whether they had actually lost support — a second, cruder wake policy
  // left over from when only sleepers occupied cells. It is unnecessary now: releasing the
  // cell notifies whatever was resting on it, and if that rock falls, its own _reindex
  // notifies the next one up. The cascade propagates itself, one rule instead of two.
  _vacate(p) {
    const key = p.cell;
    if (!key) return;
    this._release(p);
    p.cell = null;
    this._wakeAround(key);
  }

  _sleep(p) {
    p.asleep = true;
    p.vx = 0;
    p.vy = 0;
    // The settle path skips the per-step reindex, so claim the final cell here.
    this._reindex(p);
  }

  // The left wall has advanced into the mass — the pillar springing back on the win, say.
  // Shove anything now behind it back into the shaft and wake it, which is what a moving wall
  // physically does. Without this those rocks sit outside the bounds, where every move is
  // blocked on both axes, and they freeze in mid-air.
  pushRightOf(x) {
    for (const p of this.parts) {
      if (!p.alive || p.x >= x) continue;
      p.x = x;
      p.asleep = false;
      p.stillT = 0;
      p.contactT = 0;
      this._reindex(p);
    }
  }

  // Wake every sleeping rock in a vertical slice.
  //
  // Used when a gate in the grate opens. The rubble standing on that column has just lost its
  // floor, but the change happened metres below it — a radius around the cleared cell reaches
  // nothing — so without this the mass sits there as though the wall were still solid.
  wakeColumn(x0, x1) {
    for (const p of this.parts) {
      if (!p.alive || !p.asleep) continue;
      if (p.x < x0 || p.x > x1) continue;
      p.asleep = false;
      p.stillT = 0;
      p.contactT = 0;
    }
  }

  // Shake loose any settled rock near a point — used when a match removes a block.
  // Only wakes them; they keep their cells because they are still physically there. As they
  // fall, _reindex wakes whatever was resting on them, and the avalanche climbs on its own.
  disturb(x, y, radius) {
    const r2 = radius * radius;
    for (const p of this.parts) {
      if (!p.alive || !p.asleep) continue;
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy > r2) continue;
      p.asleep = false;
      p.stillT = 0;
      p.contactT = 0;
      p.vx += (Math.random() - 0.5) * 40;
    }
  }

  // ---------------- spawning ----------------

  _pickType() {
    const r = Math.random() * this._cumTotal;
    for (let i = 0; i < this._cum.length; i++) if (r < this._cum[i]) return i;
    return this._cum.length - 1;
  }

  // Returns null when the pool is full. Callers must cope with that rather than assume a
  // rock came back.
  spawn(x, y, { vx = 0, vy = 0, tint = 0, glow = 0 } = {}) {
    // Find a DEAD slot. This used to take parts[_next] round-robin regardless of whether
    // that rock was still alive, so once the cursor wrapped — which a full game does, with
    // a pool of ~400 and ~500 rocks spawned over its length — it recycled rocks that were
    // still sitting in the pile. They vanished from the middle of the mass, which is
    // exactly what it looked like.
    let slot = -1;
    for (let i = 0; i < this.max; i++) {
      const idx = (this._next + i) % this.max;
      if (!this.parts[idx].alive) { slot = idx; break; }
    }
    if (slot < 0) return null; // full: the mass is already at its cap, drop the arrival

    const p = this.parts[slot];
    this._vacate(p);
    this.live++;
    this._next = (slot + 1) % this.max;

    p.alive = true;
    p.asleep = false;
    p.type = this._pickType();
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.tint = tint; p.glow = glow;
    p.stillT = 0;
    p.contactT = 0;
    p.frame = Math.floor(Math.random() * ROCK_FRAMES);
    p.frameT = 0;
    p.angle = Math.random() * Math.PI * 2;
    p.drawAngle = p.angle;
    p.angleT = 0;
    p.age = 0;

    // Don't start life inside another rock. Seeding scatters rocks at random through a
    // region, so collisions at spawn are common; nudging up before the rock is ever drawn
    // is invisible, where resolving it later would be a visible jump.
    if (this.packCell > 0) {
      for (let tries = 0; tries < 8 && this._occ.has(this._keyAt(p.x, p.y)); tries++) {
        p.y -= this.packCell;
      }
    }
    p.cell = null;
    this._reindex(p);
    return p;
  }

  fill(count, { x, y, width, height }) {
    for (let i = 0; i < count; i++) {
      this.spawn(x + Math.random() * width, y + Math.random() * height);
    }
  }

  burst(count, x, y, { spread = 20, speed = 120 } = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread,
        { vx: (Math.random() - 0.5) * speed, vy: -Math.random() * speed * 0.5 }
      );
    }
  }

  // `budget` is how many rocks may still arrive, ever. Omit it to leave the current budget
  // alone — stopping and restarting the flow must not refill the shaft's allowance.
  setInflow(ratePerSec, rect = null, budget = null) {
    this.inflowRate = ratePerSec;
    if (rect) this.inflowRect = rect;
    if (budget != null) this.inflowLeft = Math.max(0, budget);
  }

  // ---------------- force chain ----------------
  //
  // Rubble is not a crowd of independent falling particles: it is a jammed mass in which
  // every rock carries what is stacked above it and passes that load down to whatever it is
  // resting on. A deep pile therefore presses far harder at its base than a shallow one, and
  // a wall beside it feels that, which is the whole reason the pillar moves.
  //
  // One top-down sweep computes it. Each rock starts carrying its own weight and hands its
  // total to the rocks beneath it, split between them. Load that reaches the floor leaves the
  // system. That is a real force chain, not an approximation of one — it just skips the
  // iterative solve a rigid-body engine would do, which at this scale nobody can see.

  _computeLoads() {
    const rocks = [];
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.load = 1;                       // its own weight
      rocks.push(p);
    }
    if (this.packCell <= 0) return rocks;

    rocks.sort((a, b) => a.y - b.y);    // highest first, so load accumulates downward
    for (const p of rocks) {
      const gx = this._gx(p.x);
      const gy = this._gy(p.y);
      let n = 0;
      // supporters: the cells directly beneath, including the diagonals a rock can rest on
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        const list = this._occ.get(`${nx},${gy + 1}`);
        if (list) n += list.length;
      }
      if (!n) continue;                 // resting on the floor: the load goes into the ground
      const share = p.load / n;
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        const list = this._occ.get(`${nx},${gy + 1}`);
        if (list) for (const q of list) q.load += share;
      }
    }
    return rocks;
  }

  // Lateral force on the left wall. Granular material pushes sideways with roughly K times
  // the vertical load it carries — K is the material's lateral earth pressure coefficient,
  // about 0.45 for loose angular rubble. Only rocks actually touching the wall can push it.
  //
  // `belowY` is where the wall face ends. A wall is only as tall as it is: rubble that has
  // dropped past the bottom of the pillar is beside scenery, not against the thing it is
  // supposed to be crushing, and counting it made the pressure keep reading high while the
  // mass was visibly pouring away.
  wallForceLeft(K = 0.45, belowY = Infinity) {
    if (!this.bounds || this.packCell <= 0) return 0;
    const reach = this.bounds.left + this.packCell;
    let force = 0;
    for (const p of this.parts) {
      if (p.alive && p.x <= reach && p.y < belowY) force += p.load;
    }
    return force * K;
  }

  // Rocks still bearing on the wall (above the drain line). Used for "how much is left",
  // which is a count question — the threat itself is the force above.
  countAbove(y) {
    let n = 0;
    for (const p of this.parts) if (p.alive && p.y < y) n++;
    return n;
  }

  get moving() {
    let n = 0;
    for (const p of this.parts) if (p.alive && !p.asleep) n++;
    return n;
  }

  // ---------------- step ----------------

  update(dt) {
    if (this.inflowRate > 0 && this.inflowRect && this.inflowLeft > 0) {
      this._inflowAcc += this.inflowRate * dt;
      while (this._inflowAcc >= 1 && this.inflowLeft > 0) {
        this._inflowAcc -= 1;
        this.inflowLeft--;
        const r = this.inflowRect;
        this.spawn(r.x + Math.random() * r.width, r.y + Math.random() * r.height);
      }
    }

    this._acc += Math.min(dt, 0.1);
    let stepped = false;
    while (this._acc >= FIXED_DT) {
      this._step(FIXED_DT);
      this._acc -= FIXED_DT;
      stepped = true;
    }
    // Once per frame, not per fixed step: the force chain is only read by the renderer and
    // the threat, and re-solving it three times inside one frame changes nothing visible.
    if (stepped) this._computeLoads();

    this._flowCooldownT = Math.max(0, this._flowCooldownT - dt);
    return stepped;
  }

  _step(dt) {
    let flowing = 0;
    const s = this.packCell;

    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (!p.alive || p.asleep) continue;

      p.age += dt;
      p.vy = Math.min(p.vy + this.gravity * dt, this.maxFall);

      if (p.vy > this.flowSpeed && p.age > this.flowStartupIgnore) flowing++;

      // --- horizontal, resolved independently so a rock can slide along a surface ---
      if (this._moveAxis(p, p.vx * dt, true)) {
        p.vx *= -this.bounce;      // glance off the wall rather than stopping dead
      }

      // --- vertical ---
      if (this._moveAxis(p, p.vy * dt, false)) {
        const impact = p.vy;
        p.vy = 0;

        // Can't fall straight down: look for a diagonal opening and roll into it.
        // This is what makes a heap slump instead of stacking into towers, and how
        // rubble migrates sideways to reach a hole.
        const leftOpen = s > 0 && !this._blocked(p.x - s, p.y + s, p) && !this._blocked(p.x - s, p.y, p);
        const rightOpen = s > 0 && !this._blocked(p.x + s, p.y + s, p) && !this._blocked(p.x + s, p.y, p);

        p.contactT += dt;

        if (leftOpen || rightOpen) {
          const dir = leftOpen && rightOpen ? (Math.random() < 0.5 ? -1 : 1) : (leftOpen ? -1 : 1);
          p.vx += dir * this.slideAccel * dt;
          p.vx += (Math.random() - 0.5) * impact * 0.05; // scatter, so flow isn't uniform
        } else {
          p.vx *= this.groundFriction;
        }

        // Stillness is measured by actual motion, not by whether an opening exists —
        // otherwise a rock perched beside a gap it can never reach rolls forever.
        if (Math.abs(p.vx) > this.freezeSpeed) p.stillT = 0;
        else p.stillT += dt;

        // Settle only after being genuinely still (contact alone must not freeze it, or
        // the mass looks like brickwork), but never let a rock jitter indefinitely.
        if ((p.stillT >= this.settleTime && Math.abs(p.vx) < this.freezeSpeed) ||
            p.contactT >= this.maxContactT) {
          this._sleep(p);
          continue;
        }
      } else {
        p.contactT = 0;                                  // airborne again
        if (p.vy > this.freezeSpeed) p.stillT = 0;
      }

      // Keep the occupancy map in step with where the rock actually is, so the rock below
      // it is a real obstacle to the next one falling.
      this._reindex(p);

      if (p.y > this.drainY) {          // escaped
        this._vacate(p);
        p.alive = false;
        p.asleep = true;
        this.live--;
        this.drained++;
        continue;
      }

      // tumble animation + deliberately chunky quantised rotation
      const speed = Math.abs(p.vx) + Math.abs(p.vy);
      if (speed > this.freezeSpeed) {
        p.frameT += dt;
        const frameStep = 1 / SPIN_FPS;
        while (p.frameT >= frameStep) {
          p.frameT -= frameStep;
          p.frame = (p.frame + 1) % ROCK_FRAMES;
        }
        p.angle += (p.vx * 0.01 + 1.5) * dt;
        p.angleT += dt;
        if (p.angleT >= 1 / ANGLE_FPS) {
          p.angleT = 0;
          p.drawAngle = Math.round(p.angle / ANGLE_STEP) * ANGLE_STEP;
        }
      }
    }

    if (this.onFlow && flowing >= this.flowMinCount && this._flowCooldownT <= 0) {
      this._flowCooldownT = this.flowCooldown;
      this.onFlow(flowing);
    }
  }

  reset() {
    this._occ.clear();
    for (const p of this.parts) {
      p.alive = false; p.asleep = true; p.cell = null; p.stillT = 0; p.contactT = 0;
    }
    this.live = 0;
    this.drained = 0;
    this._next = 0;
    this._acc = 0;
    this._inflowAcc = 0;
    this.inflowLeft = Infinity;
    this._flowCooldownT = 0;
  }
}
