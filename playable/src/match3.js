// Pure match-3 grid logic — no Three, no Pixi, no DOM.
// Kept headless on purpose: the 3D scene is being redesigned, and none of the
// rules below should care. board2d.js is the only thing that binds this to sprites.
//
// Rules (locked):
//   - swap two orthogonally adjacent cells; the swap only sticks if it makes a
//     line of 3+, otherwise the caller animates a bounce-back
//   - matched cells are removed PERMANENTLY — there is no refill, ever
//   - survivors FALL into the gap, as in any match-3; the emptiness collects at the top of
//     each column, so the board is a wall that erodes downward from its top edge
//   - falling can complete a new line, so a swap can cascade; resolve() returns one step per
//     clear and the caller animates them in order
//   - if no legal move remains, reshuffle the surviving COLOURS in place (cells never
//     move; only what they are holding changes, and never how many)
//
// GRAVITY WITH NO REFILL is what makes the board a physical object rather than a scoreboard.
// Each cell carries a plate and the rubble rests on the plates, so a column of survivors
// sliding down is the wall settling under the weight, and the gap that opens at the top is the
// rubble's way in. The mass sinks into what the player has eaten away, and a column cleared
// end to end flushes it out of the shaft entirely.
//
// The alternative — clearing in place, which this file did for a while — puts the hole exactly
// where the player matched, which sounds better and plays worse: holes scattered through six
// courses of plates never line up into anything the rubble can move through, and the wall
// stops responding to being cleared at all.
//
// 3 colours, not 5: on a no-refill board the match density has to stay high or the
// endgame starves into constant reshuffles.

export const EMPTY = -1;

export class Match3 {
  constructor({ rows, cols, colors = 3, rng = Math.random, layout = null } = {}) {
    this.rows = rows;
    this.cols = cols;
    this.colors = colors;
    this.rng = rng;
    this.initialLayout = layout;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(EMPTY));
    this.clearedCount = 0;
    if (this.initialLayout) this._applyLayout(this.initialLayout);
    else this._generate();
    this.initialCount = this.remainingCount;
  }

  // ---------------- queries ----------------

  at(r, c) {
    return this._inside(r, c) ? this.grid[r][c] : EMPTY;
  }

  isEmpty(r, c) {
    return this.at(r, c) === EMPTY;
  }

  _inside(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  get remainingCount() {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) if (this.grid[r][c] !== EMPTY) n++;
    return n;
  }

  get clearedFraction() {
    return this.initialCount ? this.clearedCount / this.initialCount : 0;
  }

  // ---------------- setup ----------------

  _applyLayout(layout) {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const v = layout[r]?.[c];
        this.grid[r][c] = v === undefined || v === null ? EMPTY : v;
      }
  }

  // Random fill with no pre-made matches, retried until at least one move exists.
  _generate() {
    for (let attempt = 0; attempt < 40; attempt++) {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) this.grid[r][c] = this._safeColor(r, c);
      if (this.findMatches().length === 0 && this.hasMove()) return;
    }
  }

  // pick a colour that doesn't complete a run of 3 with the two cells above / left
  _safeColor(r, c) {
    let ci;
    for (let guard = 0; guard < 24; guard++) {
      ci = Math.floor(this.rng() * this.colors);
      const runLeft = c >= 2 && this.grid[r][c - 1] === ci && this.grid[r][c - 2] === ci;
      const runUp = r >= 2 && this.grid[r - 1][c] === ci && this.grid[r - 2][c] === ci;
      if (!runLeft && !runUp) break;
    }
    return ci;
  }

  // ---------------- matching ----------------

  findMatches() {
    const hits = new Set();
    const add = (r, c) => hits.add(r * this.cols + c);

    for (let r = 0; r < this.rows; r++) {
      let run = 1;
      for (let c = 1; c <= this.cols; c++) {
        const cur = c < this.cols ? this.grid[r][c] : EMPTY;
        const prev = this.grid[r][c - 1];
        if (cur !== EMPTY && cur === prev) run++;
        else {
          if (run >= 3) for (let k = 1; k <= run; k++) add(r, c - k);
          run = 1;
        }
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let run = 1;
      for (let r = 1; r <= this.rows; r++) {
        const cur = r < this.rows ? this.grid[r][c] : EMPTY;
        const prev = this.grid[r - 1][c];
        if (cur !== EMPTY && cur === prev) run++;
        else {
          if (run >= 3) for (let k = 1; k <= run; k++) add(r - k, c);
          run = 1;
        }
      }
    }
    return [...hits].map((i) => ({ r: Math.floor(i / this.cols), c: i % this.cols }));
  }

  _wouldMatch(r1, c1, r2, c2) {
    if (!this._inside(r2, c2)) return false;
    if (this.isEmpty(r1, c1) || this.isEmpty(r2, c2)) return false;
    const a = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = a;
    const ok = this.findMatches().length > 0;
    this.grid[r2][c2] = this.grid[r1][c1];
    this.grid[r1][c1] = a;
    return ok;
  }

  // ---------------- moves ----------------

  // Returns null when the swap is illegal or makes nothing (caller bounces it back), otherwise
  // one entry per clear in the cascade: [{ cleared:[{r,c,color}], fell:[{from,to}] }].
  trySwap(r1, c1, r2, c2) {
    const adjacent = Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    if (!adjacent || this.isEmpty(r1, c1) || this.isEmpty(r2, c2)) return null;

    const a = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = a;

    if (this.findMatches().length === 0) {
      this.grid[r2][c2] = this.grid[r1][c1];
      this.grid[r1][c1] = a;
      return null;
    }
    return this.resolve();
  }

  // Clear, collapse, repeat until the board is quiet. One entry per clear, in the order they
  // happened, so the caller can animate the cascade rather than snapping to the end state.
  //
  // The guard is a guard, not a rule: with no refill each pass strictly removes gems, so this
  // terminates on its own. It is here so a future refill cannot turn a bug into a hung frame.
  resolve() {
    const steps = [];
    for (let guard = 0; guard < 32; guard++) {
      const matches = this.findMatches();
      if (matches.length === 0) break;

      const cleared = matches.map(({ r, c }) => ({ r, c, color: this.grid[r][c] }));
      for (const { r, c } of cleared) {
        this.grid[r][c] = EMPTY;
        this.clearedCount++;
      }
      steps.push({ cleared, fell: this._collapse() });
    }
    return steps;
  }

  // Survivors fall to the bottom of their column; the emptiness ends up at the top. Returns
  // the moves as { from, to } so the view can tween the same gems rather than re-syncing the
  // whole board — a re-sync would teleport every survivor and lose the fall entirely.
  _collapse() {
    const fell = [];
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] === EMPTY) continue;
        if (write !== r) {
          this.grid[write][c] = this.grid[r][c];
          this.grid[r][c] = EMPTY;
          fell.push({ from: { r, c }, to: { r: write, c } });
        }
        write--;
      }
    }
    return fell;
  }

  hasMove() {
    return this.findHint() !== null;
  }

  // First legal swap found, as { a:{r,c}, b:{r,c} }. Drives both the hint and the
  // tutorial mask (dim everything except these cells).
  findHint() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        if (this._wouldMatch(r, c, r, c + 1)) return { a: { r, c }, b: { r, c: c + 1 } };
        if (this._wouldMatch(r, c, r + 1, c)) return { a: { r, c }, b: { r: r + 1, c } };
      }
    return null;
  }

  // Shuffle the surviving COLOURS between the cells that still hold one — never creates or
  // destroys a gem, and never moves a cell. The wall itself is untouched: a plate stands
  // wherever a gem stands, so a colour shuffle cannot open or close a single hole.
  // Returns the cells and the colour each ended up with, so the view can re-tint just those.
  reshuffle() {
    const cells = [];
    const colors = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c] !== EMPTY) {
          cells.push({ r, c });
          colors.push(this.grid[r][c]);
        }
    if (cells.length < 3) return [];

    // Two properties are wanted: no match already sitting on the board, and at least one
    // legal move. The second is a nice-to-have — a board with no move is simply finished.
    // The first is not negotiable: a ready-made match clears itself with no input, which
    // reads as a bug.
    //
    // Shuffling at random finds both most of the time, but not reliably — even a 4x4 board
    // of two colours, where a valid layout demonstrably exists, needs a fairly specific one,
    // and 40 random draws missed it often enough to fail a test roughly 1 run in 20.
    let fallback = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
      }
      cells.forEach((p, i) => (this.grid[p.r][p.c] = colors[i]));

      if (this.findMatches().length === 0) {
        if (this.hasMove()) return this._snapshot(cells);
        if (!fallback) fallback = colors.slice();
      }
    }
    if (fallback) cells.forEach((p, i) => (this.grid[p.r][p.c] = fallback[i]));

    // So stop trusting luck and repair the arrangement instead: take a cell that is part of
    // a match and swap its colour with a random cell of a different colour. Swapping keeps
    // the colour counts exact, and each swap strictly targets an offending cell, so this
    // converges in a handful of passes where random redraws can wander indefinitely.
    for (let pass = 0; pass < 300; pass++) {
      const bad = this.findMatches();
      if (!bad.length) break;
      const a = bad[Math.floor(this.rng() * bad.length)];
      const b = cells[Math.floor(this.rng() * cells.length)];
      if (this.grid[a.r][a.c] === this.grid[b.r][b.c]) continue;
      const t = this.grid[a.r][a.c];
      this.grid[a.r][a.c] = this.grid[b.r][b.c];
      this.grid[b.r][b.c] = t;
    }

    return this._snapshot(cells);
  }

  _snapshot(cells) {
    return cells.map(({ r, c }) => ({ r, c, color: this.grid[r][c] }));
  }

  // Call after every resolve; true if the board had to be shuffled to stay playable.
  ensurePlayable() {
    if (this.remainingCount < 3) return false;
    if (this.hasMove()) return false;
    this.reshuffle();
    return true;
  }

  toString() {
    return this.grid.map((row) => row.map((v) => (v === EMPTY ? '.' : v)).join('')).join('\n');
  }
}
