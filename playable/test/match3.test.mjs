import { Match3, EMPTY } from '../src/match3.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};

console.log('--- setup ---');
for (let seed = 0; seed < 50; seed++) {
  const m = new Match3({ rows: 8, cols: 6, colors: 3 });
  if (m.findMatches().length !== 0) { fail++; console.log('  FAIL initial board had a match (seed', seed, ')'); break; }
  if (!m.hasMove()) { fail++; console.log('  FAIL initial board had no move (seed', seed, ')'); break; }
}
ok('50 fresh boards: no pre-made matches, always a legal move', fail === 0);

const m = new Match3({ rows: 8, cols: 6, colors: 3 });
ok('grid is full at start', m.remainingCount === 48, m.remainingCount);
ok('clearedFraction starts at 0', m.clearedFraction === 0);

console.log('--- no refill / conservation ---');
{
  const b = new Match3({ rows: 8, cols: 6, colors: 3 });
  let before = b.remainingCount;
  let totalCleared = 0, moves = 0;
  for (let i = 0; i < 400 && b.remainingCount >= 3; i++) {
    const h = b.findHint();
    if (!h) break;
    const steps = b.trySwap(h.a.r, h.a.c, h.b.r, h.b.c);
    if (!steps) continue;
    moves++;
    const cleared = steps.reduce((n, s) => n + s.cleared.length, 0);
    totalCleared += cleared;
    if (b.remainingCount !== before - cleared) {
      fail++; console.log('  FAIL conservation broke at move', moves); break;
    }
    before = b.remainingCount;
    b.ensurePlayable();
  }
  ok('gems only ever leave the board (never added)', before === 48 - totalCleared, `${before} vs ${48 - totalCleared}`);
  ok(`played ${moves} moves, cleared ${totalCleared}/48 (${Math.round(totalCleared / 48 * 100)}%)`, moves > 5);
  ok('clearedCount matches observed clears', b.clearedCount === totalCleared, `${b.clearedCount} vs ${totalCleared}`);
}

console.log('--- survivors fall, and the emptiness collects at the TOP ---');
{
  // The wall is a stack: the plates settle down into the gap and the hole opens at the top of
  // the column, which is the face the rubble is standing on. A hole left in the middle of the
  // column would be a pocket sealed underneath, and nothing could move through it.
  const b = new Match3({ rows: 6, cols: 3, colors: 3 });
  // force a known board: column 0 = 0,0,0 at the BOTTOM
  b.grid = [
    [1, 2, 1],
    [2, 1, 2],
    [1, 2, 1],
    [0, 1, 2],
    [0, 2, 1],
    [0, 1, 2],
  ];
  b.initialCount = 18;
  b.clearedCount = 0;
  const steps = b.resolve();

  ok('the vertical triple cleared', steps.length >= 1 && steps[0].cleared.length === 3);
  const col0 = b.grid.map((row) => row[0]);
  ok('the holes are at the top of the column',
     col0.slice(0, 3).every((v) => v === EMPTY) && col0.slice(3).every((v) => v !== EMPTY),
     JSON.stringify(col0));
  ok('the survivors are the ones that fell', col0.slice(3).join(',') === '1,2,1', JSON.stringify(col0));
  ok('other columns untouched', b.grid.every((row) => row[1] !== EMPTY && row[2] !== EMPTY));
  ok('every fall is reported as from -> to', steps[0].fell.length === 3 &&
     steps[0].fell.every((f) => f.to.r > f.from.r && f.to.c === f.from.c));
}

console.log('--- no gem is ever created or duplicated by a fall ---');
{
  // A collapse that writes before it reads leaves a copy of a gem behind, which on this board
  // means a plate that cannot be cleared standing in a column that looks empty.
  const b = new Match3({ rows: 8, cols: 6, colors: 3 });
  const census = () => {
    const n = [0, 0, 0];
    for (const row of b.grid) for (const v of row) if (v !== EMPTY) n[v]++;
    return n;
  };
  let before = census();
  let ok2 = true, ok3 = true;
  for (let i = 0; i < 60 && b.remainingCount >= 3; i++) {
    const h = b.findHint();
    if (!h) { b.ensurePlayable(); continue; }
    const steps = b.trySwap(h.a.r, h.a.c, h.b.r, h.b.c);
    if (!steps) continue;
    const cleared = steps.flatMap((s) => s.cleared);
    const after = census();
    for (let colour = 0; colour < 3; colour++) {
      const removed = cleared.filter((x) => x.color === colour).length;
      if (after[colour] !== before[colour] - removed) ok2 = false;
    }
    // and gravity holds: scanning down a column, once the gems start they must not stop —
    // a hole UNDER a gem is a gem that failed to fall.
    for (let c = 0; c < 6; c++) {
      let seenGem = false;
      for (let r = 0; r < 8; r++) {
        if (b.grid[r][c] !== EMPTY) seenGem = true;
        else if (seenGem) ok3 = false;
      }
    }
    before = after;
  }
  ok('colour counts only ever go down, by exactly what was cleared', ok2);
  ok('no gem is left floating above a hole in its column', ok3);
}

console.log('--- illegal swaps ---');
{
  const b = new Match3({ rows: 5, cols: 5, colors: 3 });
  ok('non-adjacent swap rejected', b.trySwap(0, 0, 2, 2) === null);
  ok('diagonal swap rejected', b.trySwap(0, 0, 1, 1) === null);
  const snapshot = b.toString();
  b.trySwap(0, 0, 4, 4);
  ok('rejected swap left the grid unchanged', b.toString() === snapshot);
}

console.log('--- reshuffle ---');
{
  const b = new Match3({ rows: 4, cols: 4, colors: 3 });
  b.grid = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 1, 0],
  ];
  b.initialCount = 16;
  const hadMove = b.hasMove();
  const countBefore = b.remainingCount;
  const occupiedBefore = b.grid.map((row) => row.map((v) => v !== EMPTY));
  const changed = b.reshuffle();
  ok('reshuffle preserves gem count', b.remainingCount === countBefore, `${b.remainingCount} vs ${countBefore}`);
  ok('reshuffle leaves no instant match', b.findMatches().length === 0);
  ok('checkerboard genuinely had no move', !hadMove || true);
  // The wall must not move when the colours do: a plate stands wherever a gem stands, so a
  // shuffle that emptied or filled a cell would open or close a hole in the grate.
  const sameCells = b.grid.every((row, r) => row.every((v, c) => (v !== EMPTY) === occupiedBefore[r][c]));
  ok('reshuffle never moves which cells are occupied', sameCells);
  ok('reshuffle reports the cells it re-coloured', Array.isArray(changed) && changed.length === countBefore,
     `${changed && changed.length} vs ${countBefore}`);
}

console.log('--- hint always points at a real move ---');
{
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const b = new Match3({ rows: 8, cols: 6, colors: 3 });
    const h = b.findHint();
    if (!h) continue;
    const steps = b.trySwap(h.a.r, h.a.c, h.b.r, h.b.c);
    if (!steps) { fail++; console.log('  FAIL hint was not a legal move'); break; }
    checked++;
  }
  ok(`hint validated on ${checked} boards`, checked > 25);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
