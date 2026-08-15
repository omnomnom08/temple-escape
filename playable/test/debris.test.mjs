import { DebrisSim } from '../src/debris_sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};
const run = (sim, seconds) => { for (let i = 0; i < seconds * 60; i++) sim.update(1 / 60); };

// A fake wall: cells solid between y 500..900, x 100..700. Rocks rest on it.
const makeWall = () => {
  const solid = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) solid.add(r + ',' + c);
  return {
    solid,
    at: (x, y) => {
      const c = Math.floor((x - 100) / 100);
      const r = Math.floor((y - 500) / 50);
      if (r < 0 || r >= 8 || c < 0 || c >= 6) return false;
      return solid.has(r + ',' + c);
    },
  };
};

console.log('--- rubble is held back by a solid wall ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.fill(200, { x: 100, y: 200, width: 600, height: 250 });
  run(sim, 4);
  ok('nothing drained through an intact wall', sim.drained === 0, `drained=${sim.drained}`);
  ok('all rocks still live', sim.live === 200, `live=${sim.live}`);
  ok('everything settled (asleep)', sim.parts.filter((p) => p.alive && !p.asleep).length === 0);
  ok('all rocks are above the wall', sim.countAbove(900) === 200, sim.countAbove(900));
}

console.log('--- opening one column drains only that column ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.fill(200, { x: 100, y: 200, width: 600, height: 250 });
  run(sim, 3);
  for (let r = 0; r < 8; r++) wall.solid.delete(r + ',2');
  sim.disturb(400, 700, 2000);
  run(sim, 6);
  ok('some rocks escaped', sim.drained > 0, `drained=${sim.drained}`);
  ok('but not all of them', sim.drained < 200, `drained=${sim.drained}`);
  console.log(`     (drained ${sim.drained}/200 through a single open column)`);
}

console.log('--- opening the whole wall drains everything ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.fill(200, { x: 100, y: 200, width: 600, height: 250 });
  run(sim, 2);
  wall.solid.clear();
  sim.disturb(400, 700, 2000);
  run(sim, 8);
  ok('every rock drained', sim.drained === 200, `drained=${sim.drained}`);
  ok('live count back to zero', sim.live === 0, `live=${sim.live}`);
  ok('countAbove reports empty', sim.countAbove(900) === 0);
}

console.log('--- inflow is the threat clock ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.setInflow(20, { x: 100, y: 100, width: 600, height: 20 });
  ok('starts empty', sim.live === 0);
  run(sim, 2);
  const after2s = sim.live;
  ok('inflow adds rocks over time', after2s > 20, `live=${after2s}`);
  sim.setInflow(0);
  const before = sim.live;
  run(sim, 3);
  ok('stopping inflow stops arrivals', sim.live === before, `${sim.live} vs ${before}`);
}

console.log('--- the round has a fixed amount of rubble in it ---');
{
  // The shaft is allotted N rocks and gets exactly N, however long the round runs. Without a
  // budget the mass has no size: it is however much has fallen in so far, which is a function
  // of how slowly the player is playing rather than of anything designed.
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.setInflow(40, { x: 100, y: 100, width: 600, height: 20 }, 25);
  run(sim, 6);   // 240 rocks' worth of time at this rate
  ok('inflow delivers the budget and no more', sim.live === 25, `live=${sim.live}`);
  ok('the budget is spent', sim.inflowLeft === 0, `left=${sim.inflowLeft}`);

  // Re-arming the rate must not refill the allowance — that is how an "it stopped, so restart
  // it" call would quietly hand the round a second shaft of rubble.
  sim.setInflow(40);
  run(sim, 3);
  ok('restarting the flow does not refill the budget', sim.live === 25, `live=${sim.live}`);
}

console.log('--- pressure falls when the drain opens (the core loop) ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  sim.fill(180, { x: 100, y: 200, width: 600, height: 250 });
  sim.setInflow(6, { x: 100, y: 100, width: 600, height: 20 });
  run(sim, 3);
  const pressureClosed = sim.countAbove(900);

  wall.solid.clear();               // player clears the board
  sim.disturb(400, 700, 2000);
  run(sim, 6);
  const pressureOpen = sim.countAbove(900);

  ok('pressure drops once the wall is opened', pressureOpen < pressureClosed,
     `${pressureClosed} -> ${pressureOpen}`);
  console.log(`     (pressure ${pressureClosed} -> ${pressureOpen} with inflow still running)`);
}

console.log('--- flow audio only fires for a real landslide ---');
{
  let fired = 0;
  const sim = new DebrisSim({ max: 300, drainY: 2000, onFlow: () => fired++ });
  sim.spawn(300, 100);              // a single rock is not a landslide
  run(sim, 2);
  ok('one falling rock does not trigger the rumble', fired === 0, `fired=${fired}`);

  fired = 0;
  const sim2 = new DebrisSim({ max: 300, drainY: 2000, onFlow: () => fired++ });
  sim2.fill(60, { x: 100, y: 100, width: 600, height: 100 });
  run(sim2, 2);
  ok('a mass of falling rock does trigger it', fired > 0, `fired=${fired}`);
}

console.log('--- rocks rest on each other, so the mass has depth ---');
{
  const wall = makeWall();
  const noPack = new DebrisSim({ max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y) });
  noPack.fill(150, { x: 100, y: 100, width: 600, height: 300 });
  run(noPack, 5);
  const spreadNoPack = (() => {
    const ys = noPack.parts.filter((p) => p.alive).map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  })();

  const wall2 = makeWall();
  const packed = new DebrisSim({
    max: 300, drainY: 1400, solidAt: (x, y) => wall2.at(x, y), packCell: 20,
  });
  packed.fill(150, { x: 100, y: 100, width: 600, height: 300 });
  run(packed, 5);
  const spreadPacked = (() => {
    const ys = packed.parts.filter((p) => p.alive).map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  })();

  ok('packed mass is deeper than an unpacked sheet', spreadPacked > spreadNoPack * 1.5,
     `packed=${spreadPacked.toFixed(0)} vs flat=${spreadNoPack.toFixed(0)}`);
  console.log(`     (vertical depth: ${spreadNoPack.toFixed(0)}px flat -> ${spreadPacked.toFixed(0)}px packed)`);

  const sleepers = packed.parts.filter((p) => p.alive && p.asleep).length;
  ok('occupancy never exceeds the number of settled rocks', packed._occ.size <= sleepers,
     `${packed._occ.size} cells vs ${sleepers} sleepers`);
  // Some overlap is expected — real rubble interlocks, and a rock that can't claim a
  // cell simply sleeps unregistered (it just supports nothing above it). Observed range
  // is 82-88%; the threshold sits below that so the test isn't flaky. The hard
  // invariants (no double-booking, no leak) are asserted separately above and below.
  ok('the great majority of settled rocks own a distinct cell', packed._occ.size > sleepers * 0.75,
     `${packed._occ.size}/${sleepers}`);

  // the invariant that actually matters: the map must not leak as rocks drain away
  wall2.solid.clear();
  packed.disturb(400, 700, 2000);
  run(packed, 8);
  ok('occupancy map is empty once everything has drained', packed._occ.size === 0,
     `leaked ${packed._occ.size} cells`);
}

console.log('--- the mass presses on the wall, and depth is what makes it press ---');
{
  // The threat is a force, not a headcount: rubble pushes because it is stacked and jammed.
  // A deep pile must press much harder than the same rocks spread thin, and force per rock
  // must RISE with depth — that superlinearity is the whole physical claim of the model.
  const bounds = { left: 100, right: 700 };
  const measure = (count) => {
    const wall = makeWall();
    const sim = new DebrisSim({
      max: 900, drainY: 1400, solidAt: (x, y) => wall.at(x, y), packCell: 20, bounds,
    });
    sim.fill(count, { x: 100, y: 500 - count * 3, width: 600, height: count * 2.6 });
    run(sim, 6);
    return { force: sim.wallForceLeft(), live: sim.live };
  };

  const shallow = measure(100);
  const deep = measure(300);

  ok('a resting mass exerts force on the wall', shallow.force > 0, `force=${shallow.force.toFixed(1)}`);
  ok('three times the rubble pushes MORE than three times as hard',
     deep.force > shallow.force * 3, `${shallow.force.toFixed(1)} -> ${deep.force.toFixed(1)}`);
  ok('force per rock rises with depth',
     deep.force / deep.live > shallow.force / shallow.live,
     `${(shallow.force / shallow.live).toFixed(3)} -> ${(deep.force / deep.live).toFixed(3)}`);
  console.log(`     (${shallow.live} rocks -> ${shallow.force.toFixed(0)} force; ` +
    `${deep.live} rocks -> ${deep.force.toFixed(0)} force)`);
}

console.log('--- draining the mass releases the wall ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({
    max: 500, drainY: 1400, solidAt: (x, y) => wall.at(x, y), packCell: 20,
    bounds: { left: 100, right: 700 },
  });
  sim.fill(300, { x: 100, y: -300, width: 600, height: 700 });
  run(sim, 6);
  const loaded = sim.wallForceLeft();

  wall.solid.clear();                      // open the whole grate
  for (const p of sim.parts) if (p.alive) p.asleep = false;
  run(sim, 12);
  const released = sim.wallForceLeft();

  ok('a loaded wall reads a real force', loaded > 10, `force=${loaded.toFixed(1)}`);
  ok('draining the mass releases the wall', released < loaded * 0.1,
     `${loaded.toFixed(1)} -> ${released.toFixed(1)}`);
  console.log(`     (wall force ${loaded.toFixed(0)} -> ${released.toFixed(0)} once drained)`);
}

console.log('--- avalanche: pulling one rock cascades the column above ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({
    max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y), packCell: 20,
  });
  sim.fill(200, { x: 100, y: 150, width: 600, height: 300 });
  run(sim, 6);
  ok('the mass fully comes to rest', sim.moving === 0, `moving=${sim.moving}`);

  const settledY = sim.parts.filter((p) => p.alive).map((p) => p.y);
  const pileTop = Math.min(...settledY);
  const pileBottom = Math.max(...settledY);

  // Punch a hole at the BOTTOM of one column, exactly as a match would.
  for (let r = 0; r < 8; r++) wall.solid.delete(r + ',2');
  sim.disturb(350, pileBottom, 25);   // only nudge rocks right at the hole

  // The cascade must reach rocks near the TOP of the pile, far from what was touched.
  let highestMoved = Infinity;
  for (let i = 0; i < 90; i++) {
    sim.update(1 / 60);
    for (const p of sim.parts) {
      if (p.alive && !p.asleep) highestMoved = Math.min(highestMoved, p.y);
    }
  }
  const reach = (pileBottom - highestMoved) / (pileBottom - pileTop);
  ok('the disturbance travels up through the mass, not just at the hole', reach > 0.5,
     `reached ${(reach * 100).toFixed(0)}% of pile height`);
  console.log(`     (hole at the base -> cascade reached ${(reach * 100).toFixed(0)}% up the pile)`);
}

console.log('--- rocks settle over time, not on first contact ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({
    max: 300, drainY: 1400, solidAt: (x, y) => wall.at(x, y), packCell: 20, settleTime: 0.18,
  });
  sim.fill(120, { x: 100, y: 200, width: 600, height: 200 });
  run(sim, 0.6);
  const movingEarly = sim.moving;
  run(sim, 4);
  const movingLate = sim.moving;
  ok('rocks are still jostling shortly after landing', movingEarly > 0, `moving=${movingEarly}`);
  ok('and everything comes to rest eventually', movingLate === 0, `moving=${movingLate}`);
  console.log(`     (moving after 0.6s: ${movingEarly}, after 4.6s: ${movingLate})`);
}

console.log('--- pool never overflows ---');
{
  const sim = new DebrisSim({ max: 50, drainY: 5000 });
  sim.fill(200, { x: 0, y: 0, width: 100, height: 100 });
  ok('live count is capped at max', sim.live <= 50, `live=${sim.live}`);
  ok('pool array stays fixed size', sim.parts.length === 50);
}

console.log('--- rocks stay inside the shaft walls ---');
{
  // No wall to rest on and a hard floor far below: the only thing that can stop a rock
  // leaving sideways is the bounds check.
  const sim = new DebrisSim({
    max: 200, drainY: 5000, packCell: 40,
    bounds: { left: 200, right: 600 },
  });
  sim.fill(150, { x: 210, y: 100, width: 380, height: 200 });
  // shove every rock hard sideways
  for (const p of sim.parts) if (p.alive) p.vx = (Math.random() < 0.5 ? -1 : 1) * 1500;
  run(sim, 3);
  const escaped = sim.parts.filter((p) => p.alive && (p.x < 200 - 40 || p.x > 600 + 40));
  ok('no rock crossed the shaft walls', escaped.length === 0, `${escaped.length} escaped`);
}

console.log('--- a live rock is never recycled out from under the pile ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({ max: 60, drainY: 1400, packCell: 40, solidAt: (x, y) => wall.at(x, y) });
  sim.fill(60, { x: 100, y: 300, width: 600, height: 150 });
  run(sim, 2);
  const before = sim.live;
  // Ask for far more than the pool can hold, as a long inflow would.
  let refused = 0;
  for (let i = 0; i < 100; i++) if (sim.spawn(300, 200) === null) refused++;
  ok('spawn refuses instead of overwriting live rocks', refused > 0, `refused=${refused}`);
  ok('no live rock was destroyed by spawning', sim.live >= before, `${sim.live} vs ${before}`);
  ok('live count never exceeds the pool', sim.live <= 60, `live=${sim.live}`);
}

console.log('--- nothing is left floating once its support drains away ---');
{
  const wall = makeWall();
  const sim = new DebrisSim({
    max: 250, drainY: 1400, packCell: 40,
    solidAt: (x, y) => wall.at(x, y),
    // Bounded, like the real shaft. Without walls a dense pile squeezes rocks off the sides
    // and they fall past the wall entirely — which is the bug the bounds were added for.
    bounds: { left: 100, right: 700 },
  });
  // Spread the seed over enough area that the rocks actually fit. Rocks now collide with
  // each other while falling, so a region with fewer pack cells than rocks cannot settle —
  // it used to "work" only because falling rocks passed through one another.
  sim.fill(220, { x: 100, y: -350, width: 600, height: 800 });
  run(sim, 7);
  const settled = sim.parts.filter((p) => p.alive && p.asleep).length;

  // open the whole wall — every rock should end up draining, none stranded in mid-air
  wall.solid.clear();
  for (const p of sim.parts) if (p.alive) { sim._vacate(p); p.asleep = false; }
  run(sim, 10);

  ok('the mass settled before the wall opened', settled > 150, `settled=${settled}`);
  ok('everything drained — no rock stranded in mid-air', sim.live === 0, `${sim.live} still live`);
  // The invariant the occupancy model rests on: a live rock is always registered in the grid,
  // so it is always an obstacle to the rocks around it. When cells held a single rock, ~5% of
  // the mass lost its registration and quietly stopped colliding.
  const registered = sim.parts.filter((p) => p.alive && p.cell).length;
  ok('every live rock is registered in the grid', registered === sim.live, `${registered}/${sim.live}`);
}

console.log('--- opening a gate under a settled pile makes it pour ---');
{
  // The grate is a row of column-gates. A gate opening is a change far below the rubble
  // resting on it, so nothing in the neighbourhood tells that rubble anything — it went on
  // standing on a wall that was no longer there. Waking the slice is what connects them.
  const open = [false, false, false];
  const sim = new DebrisSim({
    max: 400, packCell: 20, drainY: 1400,
    bounds: { left: 100, right: 700 },
    solidAt: (x, y) => {
      if (y < 500) return false;
      if (x < 100 || x >= 700) return true;
      if (y >= 800) return false;
      const c = Math.floor((x - 100) / 200);
      return c >= 0 && c < 3 ? !open[c] : false;
    },
  });
  sim.fill(240, { x: 100, y: 150, width: 600, height: 320 });
  run(sim, 5);
  const settled = sim.drained;

  open[1] = true;                       // open the middle gate, tell nobody
  run(sim, 4);
  const quiet = sim.drained;

  sim.wakeColumn(300, 500);             // now tell the rubble standing on it
  run(sim, 6);
  const woken = sim.drained;

  ok('an intact grate holds everything', settled === 0, `drained=${settled}`);
  ok('a gate opening alone moves nothing — the pile must be told', quiet === settled,
     `drained=${quiet}`);
  ok('waking the column above an open gate drains it', woken > 40,
     `drained ${quiet} -> ${woken}`);
  console.log(`     (gate opened: ${quiet} drained; after waking the column: ${woken})`);
}

console.log('--- the wall may answer per rock, and per height ---');
{
  // Two things board2d needs from the sim and nothing else does.
  //
  // 1. solidAt is handed the rock, so the grate can be one plate thick: what has already gone
  //    through a hole is not stopped again by the plates behind it. Without the `self`
  //    argument the panel is six courses of masonry and the rubble never leaves.
  // 2. wallForceLeft takes the height the wall face ends at, so rubble that has dropped past
  //    the bottom of the pillar stops counting as something pressing on it.
  const solidRows = new Set([0, 1, 2, 3]);        // a four-course wall at y 500..700
  const sim = new DebrisSim({
    max: 50, packCell: 20, drainY: 1400,
    bounds: { left: 100, right: 700 },
    solidAt: (x, y, self) => {
      if (y < 500 || y >= 700) return false;
      if (self && self.throughGrate) return false;   // already past it
      return solidRows.has(Math.floor((y - 500) / 50));
    },
  });

  const stopped = sim.spawn(300, 300);
  run(sim, 3);
  ok('a rock is held up by the wall', stopped.alive && stopped.y < 500, `y=${stopped.y.toFixed(0)}`);
  ok('and nothing drained', sim.drained === 0, `drained=${sim.drained}`);

  stopped.throughGrate = true;                       // it found a hole
  stopped.asleep = false;
  for (let i = 0; i < 240; i++) {
    sim.update(1 / 60);
    for (const p of sim.parts) if (p.alive) p.throughGrate = p.y > 500;
  }
  ok('a rock that is through the grate falls past the plates behind it', sim.drained === 1,
     `drained=${sim.drained}`);

  const force = new DebrisSim({
    max: 20, packCell: 20, drainY: 5000, bounds: { left: 100, right: 700 },
  });
  const high = force.spawn(105, 200);
  const low = force.spawn(105, 900);
  force._computeLoads();
  ok('both rocks bear on the wall when the face runs the full height',
     force.wallForceLeft(0.45) > force.wallForceLeft(0.45, 500), 'expected the cut-off to remove one');
  ok('rubble below the wall face presses nothing',
     Math.abs(force.wallForceLeft(0.45, 500) - 0.45 * high.load) < 1e-9,
     `${force.wallForceLeft(0.45, 500)} vs ${0.45 * high.load}`);
  ok('the low rock is what the cut-off removed', low.y > 500);
}

console.log('--- a wall that gives ground must not be abandoned by the pile ---');
{
  // The regression behind "the fail outcome never fires". board2d drives bounds.left off the
  // pillar, which retreats as the rubble wins. Settled rock sleeps, so nothing followed the
  // wall in: a gap opened at the face and wallForceLeft — sampled in one pack cell at
  // bounds.left — measured the gap instead of the mass. Force collapsed exactly when the
  // threat was greatest, push stalled around 0.43, and the round could not be lost.
  //
  // Floor everywhere below y 500 so nothing drains and force is the only variable.
  const sim = new DebrisSim({
    max: 200, packCell: 20, drainY: 1400,
    bounds: { left: 100, right: 700 },
    solidAt: (x, y) => y >= 500 && y < 900,
  });
  // Deep against the wall, not a thin spread: rock slumps sideways only when it has lost what
  // was under it, so a one-layer pile on a flat floor would not follow the wall no matter what
  // woke it, and the test would be measuring the pile shape rather than the fix.
  sim.fill(150, { x: 100, y: 100, width: 300, height: 400 });
  run(sim, 5);
  const before = sim.wallForceLeft(0.45);

  sim.bounds.left -= 20;          // the pillar gives ground, one pack cell of it
  run(sim, 1);
  const abandoned = sim.wallForceLeft(0.45);

  // What setLeftBound now does — EVERY frame the wall moves, which in the game is every frame
  // push changes. Waking once is not the fix and does not reliably work: the mass has to be
  // held awake while the gap is opening.
  for (let i = 0; i < 120; i++) {
    sim.wakeColumn(sim.bounds.left, sim.bounds.left + 40);
    sim.update(1 / 60);
  }
  const recovered = sim.wallForceLeft(0.45);

  ok('a settled pile presses on the wall', before > 0, `force=${before.toFixed(1)}`);
  ok('a sleeping pile does NOT follow a retreating wall on its own', abandoned < before * 0.5,
     `${before.toFixed(1)} -> ${abandoned.toFixed(1)}`);
  ok('waking the face lets the mass slump in and press again', recovered > before * 0.25,
     `${abandoned.toFixed(1)} -> ${recovered.toFixed(1)}, wanted > ${(before * 0.25).toFixed(1)}`);
  console.log(`     (force ${before.toFixed(0)} -> ${abandoned.toFixed(0)} abandoned ` +
              `-> ${recovered.toFixed(0)} after waking the face)`);
}

// The win outro: the pillar comes down as rubble where it stood, which is OUTSIDE the shaft it
// was the left wall of. Board2D.collapsePillar opens the bound before it spawns anything; this
// is why it has to, and what the debris does once it has.
//
// Geometry mirrors the game's. The grate is x 100..700; left of it is the stone ledge the grid
// is set into, which is solid floor. The pillar stands ON that ledge with its right face just
// inside the first column — x 70..130 — so it is mostly outside the shaft it walls in, and the
// shaft's left bound is its face at 130.
const collapseSim = (wall, left) => new DebrisSim({
  max: 300, drainY: 1400, packCell: 20,
  solidAt: (x, y) => (y >= 500 && x < 100 ? true : wall.at(x, y)),
  bounds: { left, right: 700 },
});
// The column at the instant it comes apart: pivoted on its base at (130, 500), turned 1.05 rad
// into the shaft and still turning at 4.17 rad/s. Same frame and the same rigid-body velocities
// collapsePillar lays out — the foot barely stirs, the head is flung down the shaft.
const PIVOT = { x: 130, y: 500, angle: 1.05, rate: 4.17, length: 240, width: 60, pivot: 0.75 };
const dropPillar = (sim) => {
  const { x, y, angle, rate, length, width, pivot } = PIVOT;
  const upX = Math.sin(angle), upY = -Math.cos(angle);
  const acrossX = Math.cos(angle), acrossY = Math.sin(angle);
  for (let r = 0; r < 12; r++) {
    const u = (r + 0.5) * (length / 12);
    for (let c = 0; c < 3; c++) {
      const v = ((c + 0.5) / 3 - pivot) * width;
      const px = x + upX * u + acrossX * v;
      const py = y + upY * u + acrossY * v;
      const rx = px - x, ry = py - y;
      sim.spawn(px, py, { vx: rate * -ry, vy: rate * rx, tint: 0xffff4d, glow: 0xb87800 });
    }
  }
};

console.log('--- the pillar collapses into the shaft ---');
{
  // Left where it is: the pieces that landed outside the old wall are blocked on both axes.
  const stuckSim = collapseSim(makeWall(), 130);
  dropPillar(stuckSim);
  const spawned = stuckSim.parts.filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y }));
  const outside = spawned.filter((p) => p.x < 130).length;
  run(stuckSim, 3);
  const stranded = stuckSim.parts
    .filter((p, i) => p.alive && spawned[i].x < 130 && Math.abs(p.y - spawned[i].y) < 1).length;
  ok('a piece left outside the shaft wall hangs in mid-air (why the bound must open first)',
     outside > 0 && stranded === outside, `${stranded} of ${outside} stranded`);

  const wall = makeWall();
  // What collapsePillar does: open out to reach the leftmost piece, and no further.
  const sim = collapseSim(wall, Math.min(...spawned.map((p) => p.x)) - 20);
  dropPillar(sim);
  run(sim, 4);
  const live = sim.parts.filter((p) => p.alive);
  ok('all 36 pieces are still in play', live.length === 36, `live=${live.length}`);
  ok('every piece came to rest', live.every((p) => p.asleep),
     `${live.filter((p) => !p.asleep).length} still moving`);
  ok('it jams on an intact board rather than draining', sim.drained === 0, `drained=${sim.drained}`);
  ok('and it lands on the wall, not inside it',
     live.every((p) => p.y < 520), `lowest=${Math.max(...live.map((p) => p.y)).toFixed(0)}`);
  ok('the pieces carry the pillar\'s colour', live.every((p) => p.tint === 0xffff4d && p.glow),
     `${live.filter((p) => !p.tint).length} untinted`);

  // The head of a toppling column is flung; its foot barely stirs. That spread is the whole
  // difference between a column that fell over and one that dissolved where it stood, and it
  // comes out of the rigid-body velocity rather than being dialled in.
  const spread = Math.max(...live.map((p) => p.x)) - Math.min(...live.map((p) => p.x));
  ok('it lies across the board rather than heaping at its own foot', spread > PIVOT.length,
     `spread=${spread.toFixed(0)} over a ${PIVOT.length}-long column`);
  console.log(`     (${live.length} pieces strewn over ${spread.toFixed(0)} units of grate)`);
}

console.log('--- ...and pours through the columns the player opened ---');
{
  const wall = makeWall();
  for (let r = 0; r < 8; r++) { wall.solid.delete(r + ',0'); wall.solid.delete(r + ',1'); }
  const sim = collapseSim(wall, 100);
  dropPillar(sim);
  run(sim, 6);
  ok('some of the pillar drained through the cleared columns', sim.drained > 0,
     `drained=${sim.drained}`);
  ok('but the rest is stuck on what is left standing', sim.live > 0, `live=${sim.live}`);
  console.log(`     (${sim.drained}/36 pieces went through, ${sim.live} jammed)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
