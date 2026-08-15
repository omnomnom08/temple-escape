# 02 — Build Log

## The design, in one diagram

An explorer is braced against a yellow pillar. Rubble rains down onto a grate, piling up
against the pillar and driving it — and him — toward a bank of spikes. The grate is the
match-3 board.

```
   PLAY     rubble pours IN   (constant rate — this is the clock)
                 │
                 ▼
        mass on the grate ──► drives the PILLAR left ──► hero into spikes = FAIL
                 │
                 └── matches open holes ──► mass drains OUT ──► pillar retracts, hero safe
                                                      │
                                                      ▼
   OUTRO                            rope drops from above ──► door opens
                                                      │
                                    hero jumps to the rope, crosses to the door
                                                      │
                                                  END CARD
```

`pressure = rocks above the drain line / capacity`, a single 0..1 value. Pillar position,
strain pose, warning flash and the fail condition all read from it. There is no score and no
progress bar anywhere in the design — **the danger is the meter.**

**The win is a sequence, not a state.** Draining the mass is where the player's agency ends,
but it is not where the ad ends: the pillar retracting, the path opening, the rope, the door
and the hero's escape are the payoff the whole loop is selling. "What success looks like" is
a requirement of the brief, and a result overlay is not an answer to it.

**What fires the win: the last rock leaving the grate.** Not a cleared board. A board that
never refills stalls with roughly a tenth of its cells still occupied and no legal moves
left, so gating the win on an empty grid risks an unwinnable end state.

**Nothing is removed at the win.** Whatever blocks are still standing stay standing. The path
was cleared by playing — the holes the player opened are the reason the rubble drained — so
sweeping the remainder away in an animation would be taking credit for work the player
already did. The final board is a record of how they solved it.

Outro beats, in order: pillar retracts → rope drops and the door opens → hero jumps to the
rope and crosses → end card.

Currently implemented: everything down to the drain. The outro is designed and not yet
built — it needs the layout art and the character rig.

## Module layout

The organising principle: **rules are pure, renderers are thin.**

```
src/
├── match3.js      pure rules  — grid, swaps, cascades, hints. No Pixi, no DOM.
├── debris_sim.js  pure rules  — granular rubble. No Pixi, no DOM.
├── board2d.js     view        — layout, art, input; owns a Match3 and a DebrisSim
├── debris_pixi.js view        — one sprite per rock, one draw call
├── shine.js       view        — the gem's light echo; its own emitter, see below
├── hero.js        view        — the character; the glTF rig replaces its placeholder
├── game.js        state       — intro / play / win / fail, HUD, retry, CTA
├── art.js         asset seam  — the only module that names a file
└── main.js        boot        — Pixi init, responsive fit, ad-SDK wiring, ticker
```

Two files have no browser dependency at all, which is what makes them testable under `node`.

## What came from the template, and what didn't

Seeded from our existing match-3 playable. That project was **lightweight 3D**, and it also held the
creative's cut first act — see [`00-origins.md`](00-origins.md) for what was there and why the
dimension changed. What follows is only the inventory.

Carried over unchanged:

| file | why it came across as-is |
| ---- | ------------------------ |
| `match3.js` | 16 headless tests, and the no-refill starvation problem already solved in it |
| `debris_sim.js` | 27 headless tests covering six distinct bugs that are invisible by eye |
| `debris_pixi.js` | verified in an isolated harness — draw calls, `glError`, drain counts |
| `board2d.js` | the derived-invariant tuning lives here |
| `game.js` | state machine, HUD, retry, CTA — covers the brief's outcome requirements |
| `hero.js` | tick-driven drop-in, so it cannot stall the state machine |
| `main.js` | boot, responsive fit, ad-SDK wiring, and the single-file-build fix below |
| `test/*.mjs` | the assertions that make any of the above trustworthy — 43 at the time of writing, 83 now |

**Left behind:** all third-party placeholder art and the module that loaded it. During earlier
gameplay tuning, art from a shipped commercial creative was used as a clearly-marked stand-in
so balancing was not fought against procedural shapes. It had grown to **138 KB, about 19% of
the bundle**. The brief requires original assets, so none of it is here — not in source, not
in the build. Also left behind: the parked 3D scene module and its 1.1 MB of geometry, and a
pile of Blender backups and analysis scratch. The bundle is **188 KB gzip, down from 292 KB**;
the entire difference is that art coming out.

**Written fresh:** `src/art.js` — see below.

## Decisions

**2D Pixi for gameplay; Three.js reserved for the character.** The gameplay camera is locked
straight-on, so 3D buys nothing a sprite cannot do while costing runtime, bundle and a
lighting setup. Three stays for the character rig only: pressure is a continuous 0..1 value,
so brace→strain has to blend by animation weight, and a sprite sheet at retina quality costs
4–5× a low-poly rig for worse feedback. `#three-canvas` and the `three` dependency are a
reserved seam; tree-shaking keeps Three out of the bundle until the rig imports it.

**No physics engine.** The granular rubble is where the satisfaction in this genre lives, but
a rigid-body engine is the wrong way to buy it. Rocks are 2D sprites picking a tumble frame
by speed (cheap motion blur), sharing one texture so Pixi batches the whole mass into **one
draw call**. Collision against the wall is a grid lookup — "is the cell under this rock still
occupied?" — and rock-vs-rock contact is a coarse occupancy grid, enough that the mass has
depth and avalanches propagate upward. 200–400 rocks, no physics dependency shipped.

**Permanent removal, no refill.** Cleared cells never come back, so the board is a wall that
erodes as you play. A plate stands exactly while its cell holds a gem, and it never
moves: a match clears in place, so the wall erodes into the shape the player cut into it.
Plates are never simulated; they stop existing, and the rubble re-tests its footing.

**Three gem colours.** A board that never refills starves at higher colour counts — the
player ends up reshuffling instead of playing. Measured: three colours clears ~88% of the
board in about ten moves.

**`art.js` fails soft.** It is the only module in `src/` that names a file. With no art
present the game draws vector shapes and stays completely playable, which is how it runs right
now while the layout PSD is authored. Each file dropped into `assets/art/` upgrades one
element with no code change. Atlas geometry is imported from `debris_sim.js` rather than
duplicated, so the sheet and the simulation cannot drift apart.

## Tests — and what they actually caught

`npm test` runs 66 assertions in two headless suites. Each group exists because something was
broken.

**Match-3 (20)** — swap legality, clear correctness, clears landing exactly where they were
matched (nothing falls, nothing shuffles along), no-refill erosion, hint validity, and the
starvation measurement that settled the colour count.

**Debris sim (46)** — the interesting ones:

| bug | what the test asserts now |
| --- | ------------------------- |
| **Perpetual motion** — rocks jittered forever, the mass never settled | after 4.6s, zero rocks are still moving |
| **Slept on first contact** — the mass froze into a dead heap that no longer reacted to a hole opening | rocks are still jostling 0.6s after landing, and *only then* come to rest |
| **Occupancy double-booking** — two rocks claiming one cell, so the mass could pass through itself | occupancy never exceeds the settled-rock count, and is empty once drained |
| **Packing collapse** — rocks stacked into a one-pixel sheet instead of a pile | a packed mass measures 111px deep where the broken version measured 1px |
| **Avalanche did not propagate** — pulling a rock at the base disturbed only its neighbours | a hole at the base cascades 100% of the way up the pile |
| **Instant loss on move one** | opening pressure is 0.41, below the 1.00 fail threshold, and non-zero |
| **Pool overflow** | live count capped at `max`; the pool array never grows |

None were visible by eye. Several looked *fine* — a dead heap still renders as a pile of
rocks.

## Invariants that must not be broken

Three tuning values are **derived**, not independent, because independent values can be set to
a combination that silently destroys the game:

- `capacity` must exceed the seeded rock count, or pressure starts at 1.0 and the player loses
  on move one. Seed is derived: `capacity × startFill`.
- the pool `max` must exceed `capacity`, or pressure can never reach 1.0 and **the game can
  never be lost**. Derived: `capacity × 1.15`. This one fails silently in the direction of
  "everything looks fine".
- rubble must not sleep on first contact, and must wake when its support vacates. Both guarded
  by tests above.

## Bugs worth writing down

**The production build can break while the dev server stays healthy.** A top-level `await` in
`main.js` is fatal under `vite-plugin-singlefile`: it inlines the whole app into one module,
which turns Pixi's internal `import('./browserAll.mjs')` into a self-reference resolved by a
microtask — and with the module body suspended at the await, that microtask runs before
`const browserAll` initialises. Result: `Cannot access 'browserAll' before initialization`, a
black screen, and a dev server that shows nothing wrong because it serves real ES modules. All
async work lives inside a non-awaited `start()` for this reason.

**Pixi needs `autoDensity: true`.** Without it, on a 2× display the canvas is 1440×2560 CSS
pixels inside a 720×1280 box — everything double-size and clipped. Invisible in headless
capture, which runs at dpr 1, so layout checks pass `--force-device-scale-factor=2`.

**An unused import can drag a whole library in.** An asset module carried `import * as THREE`
for three exported functions nothing called; only tree-shaking kept Three out of the output.
Removing it took 301 → 292 KB gzip and made the 2D path genuinely independent of Three.

## Asset integration

### Getting the layers out of the PSD

The layout arrived as a 71 MB, 159-layer PSD. There is no PSD tooling on this machine — no
Python, no ImageMagick — so rather than round-trip through Photoshop for every export, the
extractor was written from scratch in Node with no dependencies: parse the Layer & Mask
section, walk the layer records, decode each channel (PackBits RLE, raw, and both zip
variants including per-row delta prediction), composite RGBA, and write PNGs with a
hand-rolled encoder.

Output: **81 layer PNGs plus a manifest** carrying each layer's `x/y/width/height`, opacity,
blend mode and hidden flag, bottom-to-top. That manifest is what makes placement exact rather
than eyeballed — every gameplay element is positioned from measured document coordinates.

It is also repeatable, which is the real value: the PSD will change again, and re-running one
script is cheaper than re-exporting 81 layers by hand.

### The coordinate model

The PSD is **1280×1280 square**, which initially read as a mistake — a 9:16 game authored at
1:1, with the stamina bar and tutorial cursor sitting outside the frame entirely.

It wasn't. The square canvas is a *source*, not a composition: the backdrop is square so it
can cover-scale for **both portrait and landscape**, and the HUD pieces are parked off-frame
deliberately because they are shared between orientations and anchored at runtime. Asking
rather than "fixing" it saved corrupting the file.

Portrait maps 1:1 vertically with a −280px x-offset (a 720-wide window centred on the
1280-wide artboard). Gameplay spans document x 367→922, landing at design x **87→642** —
which fits 720 with even margins, as authored.

The grid is **62.5 × 68.4**, not square (plates are 63×69). `board2d.js` computed a single
square `cell`; forcing the art into it would stretch plates ~9% and drift them off the
painted backdrop, so cell width and height are tracked separately.

### Baking the backdrop

Four of the 81 layers — `brick_back`, `bg_wall`, `bg_fog`, `walls` — accounted for **10.5 MB
of the 13.1 MB total**, and all four are full-canvas, static, and stacked on top of each
other. Shipping them separately is pure overdraw for zero benefit.

Composited once, offline, into a single opaque `bg.png`: **10.5 MB → 3.0 MB**, and four
full-screen draws per frame become one.

### What the art changed in the code

- **Grid 6×8 → 5×6**, matching the plate grid as authored.
- **Gems 3 → 4.** See the measurement above — the old "5 colours starves the board" rule
  turned out to be worth about 5 percentage points, not a cliff, and the win condition makes
  stranded tiles harmless anyway. Four is a readability call, not a starvation one.
- **`capacity` became derived.** It was hardcoded to 420 for a 6-column board; at 5 columns
  that silently meant a deeper pile of rubble counted as the same crush. Now
  `ROCKS_PER_CELL × cols × FULL_DEPTH_CELLS` — a physical volume that survives a layout
  change.
- **The rock tint palette was wrong for this art.** The sim inherited a greyscale-plus-tint
  pipeline, but the delivered sheets are already painted and lit warm stone, so multiplying
  by the old palette crushed them to near-black. The palette is now near-white; variety comes
  from the four separate sheets.
- **`art.js` composes the four rock strips into one atlas** at boot. They arrive as one sheet
  per rock type (1820×140 = 13 frames of 140px, matching `ROCK_FRAMES`/`ROCK_TYPES` exactly),
  but the renderer needs a single shared texture or the 200–400 rock mass stops batching into
  one draw call.

### Composing the scene

`layout.js` replaced the fixed 720×1280 scale-to-fit box. It solves two competing constraints
with one scale: the backdrop must **cover** the viewport (`scale >= max(vw,vh)/1280`) and the
playfield must **fit** on it (`scale <= min(vw/playW, vh/playH)`). Normally cover ≤ fit and
cover wins, filling the screen with the least crop; on an extreme aspect ratio they invert,
gameplay wins, and the backdrop letterboxes against a colour sampled from the art.

Orientation gets two anchor rules rather than one, because the free space is in different
places. Portrait leaves room above and below the playfield. Landscape does not — visible
document y is roughly 280–1000 against a playfield of 325–955 — but leaves ~360px gutters at
each side. Anchoring top-centre and bottom-centre in both put the banner across the hero and
the CTA on top of the board, which the first landscape capture showed immediately.

`scene.js` places the chamber straight from the manifest and owns the one thing that moves:
the pillar. Its x offset is read directly off pressure, and the hero rides the same offset,
because he is braced against it. Travel is 58 document units — measured, not guessed: the
hero's left edge is at x=432 and the spikes end at 419, so 58 closes the gap exactly.

### Three bugs found by building, not by reading

**The reshuffle could leave a ready-made match.** It shuffled up to 40 times looking for an
arrangement with no match and a legal move, and if none turned up it kept whatever the last
attempt produced — instant match included, so gems cleared themselves with no input. It
surfaced as a test failing about 1 run in 20, which is exactly the rate at which a test gets
dismissed as flaky. Fixed by replacing luck with repair: take a cell that is part of a match
and swap its colour with a random cell of a different colour. Swapping preserves the colour
counts exactly and each swap targets an offending cell, so it converges in a few passes.
0 failures in 40 runs after.

**`import.meta.glob` bundles what it matches, not what you read.** Twice. The rock loader
globbed `*.{png,webp,jpg}` over the art folder, which pulled in the 3 MB source PNG of the
backdrop and both copies of every rock sheet — no amount of filtering afterwards removes them
from the build. The audio module did the same over 23 clips where the bank uses 13. Narrowing
the two globs took the bundle from **5.0 MB gzip to 855 KB**.

**Dedupe by basename, not by extension.** With a `.webp` generated beside each `.png`, a glob
over both extensions saw every asset twice and the atlas builder reported eight rock sheets
where four exist. It only got caught because the loader logs what it found rather than
silently trusting the count.

### The debris investigation

Playtesting produced four complaints: rocks kept falling after the way was clear, rocks
vanished from the middle of the pile, some hung in mid-air, and rocks crossed the walls. They
turned out to be four independent bugs, and the report mapped onto them one-to-one.

**There were no walls.** `_blocked()` consulted the match grid and the rock-vs-rock map, and
nothing else. `solidAt` answers only for cells inside the grid and reports open space for
everything outside it, so a rock that drifted off the edge of the board saw clear air forever.
The rubble had never had a lateral bound. Added `bounds`, and the drain line moved from below
the document to just under the grate — rocks were previously falling on down the painted wall
below the board, which is its own version of the same problem.

**The pool recycled live rocks.** `spawn()` took `parts[_next]` round-robin regardless of
whether that rock was still alive. With a pool of ~400 and a full round spawning ~500, the
cursor wrapped and started overwriting rocks still sitting in the pile — which is exactly what
"they disappear from the middle" looks like. `spawn` now finds a dead slot and returns null
when the pool is full.

**`_occupy()` could sleep a rock in mid-air.** When a rock failed to claim any cell it slept
*unregistered*, invisible to the avalanche walk in `_vacate`, so it could never be woken again
and hung there permanently once its support drained away. Unregistered sleepers are now
tracked and woken whenever anything nearby vacates.

The first attempt at that fix also removed the upward-stacking step, on the theory that moving
a rock up was what put it in the air. That was wrong, and the tests caught it: pile depth
collapsed from 111px to 38px, because the stacking step is what gives the mass its depth. Each
step up is supported by construction — the only reason to move is that the cell below is
occupied. Restored, and depth came back at 119px.

**The round could not be won or lost.** This one was only findable by measuring. A harness
drove the real sim with the real board geometry and a bot that always takes the hint:

```
inflow  8/s -> win 0  fail 0  timeout 40   left 38/344   peak pressure 0.59
inflow 18/s -> win 0  fail 0  timeout 40   left 48/344   peak pressure 0.77
```

Every round hung. Two causes. The inflow never stopped, so the mass could not shrink — new
rocks landed as fast as the old ones drained. And a no-refill board strands about 17% of its
blocks permanently, so roughly 11% of the rubble rests on blocks that will never clear:
"drained to zero" was unreachable by construction. Meanwhile capacity was set so high that
pressure peaked at 0.77, making the fail state unreachable too.

Three changes, each measured rather than guessed: the inflow stops once the wall is 55% open;
the win fires at pressure ≤ 0.18 rather than 0; and capacity dropped from 344 to 219 so a
crush is actually possible. A stall rule resolves the round if the mass stops shrinking after
the inflow ends — keyed on the rock count rather than on "is anything moving", because a few
rocks jostle indefinitely and the moving count never reaches zero.

Result at the shipped settings: **97% win, 3% fail, 0% unresolved** over 30 seeded runs, ~10s
of bot play. The bot takes a move every 1.1s; a human reading the board will be slower, so
expect 20–30s and a higher failure rate.

### Polishing the rubble

Playtesting again: "the debris fall in the first second and placed flat on the tiles, and next
second get repositioned one on another. the gaps between debris are too big."

Both halves of that were one design flaw and one measurement error.

**Occupancy was only claimed when a rock fell asleep.** So falling rocks did not collide with
each other at all — they dropped straight through one another, landed in a flat overlapping
heap, and were then *teleported* one at a time onto free grid cells as they settled, sometimes
several cells up. That is precisely "flat first, then repositioned one on another", and it also
explains the holes: the pile ended up as a lattice of snapped positions rather than a heap.

Fixed by making every live rock own its cell continuously, updated as it moves, so rocks
collide while falling and settle where they actually land. The teleport is gone entirely.

Getting the wake rule right took two attempts, in opposite directions. Waking the column above
on *every* cell change kept the pile churning — it never came to rest. Waking only when the
vacating rock moved *downward* was the opposite error, since a supporter sliding sideways
removes support just as surely, and it stranded the occasional rock in mid-air. The correct
rule is to wake on any cell change but only rocks that have actually lost their footing, which
is one `_supported()` check.

**The gaps were arithmetic.** The rock art fills about 80% of its frame (measured —
`tools/rockbox.mjs`), so a rock drawn at 27.5px is visually 22px. Diagonal neighbours sit
`packCell × √2` apart — 37px — leaving a 15px hole between every diagonal pair. No amount of
physics tuning closes that; it is a spacing-versus-sprite-size relationship:

```
             pack   draw   visible   diagonal gap
  before     0.40   0.42     22px       15.0px      <- reads as a lattice
  after      0.30   0.52     27px        0.5px      <- reads as solid rock
```

Capacity scales with packing (`ROCKS_PER_CELL = 1/PACK²`), so it moved 219 → 389 and the
inflow rate with it, 14 → 25/s, to keep the same pacing. Re-running the balance sweep at the
new packing confirmed the round still resolves the same way: 97% win, 3% fail, 0% unresolved.

**How this was investigated matters more than the fixes.** Headless browser capture cannot
show any of it — rAF barely advances, so every screenshot is an early frame. Instead the real
sim was driven headlessly and its rock positions rendered straight to a PNG
(`scratchpad/pileview.mjs`), which made the lattice visible at a glance and turned "the gaps
are too big" into a number that could be tuned against.

### Making it feel heavy

Next note from playtesting: "it feels too light."

The cause was a regression introduced by the density fix above, and it is a good example of a
constant that was quietly doing two jobs. Terminal velocity was derived from the pack grid:

```js
maxFall = (packCell / FIXED_DT) * 0.5
```

That is an anti-tunnelling guard — a rock must not cross a whole cell in one step or it passes
through the pile. But it also *is* the terminal velocity. So tightening `packCell` from 26.2 to
19.6 to close the visual gaps silently dropped max fall speed from 655 to 490 px/s. The rubble
got 25% slower, on a 1280px-tall screen, and weight is mostly fall speed.

Fixed by substepping the movement: motion is split into steps no larger than half a cell, so
tunnelling is handled by *splitting* the move rather than by capping it. Terminal velocity is a
physical parameter again rather than a side effect of packing.

With that unblocked, the weight cues are: gravity `cell*26 → cell*42`, terminal velocity
`cell*30` (990 px/s measured, up from 490), and bounce `0.18 → 0.06` — rock should stop dead,
not bounce. The mass now comes to rest 1.68s after landing instead of jostling.

Plus one thing outside the simulation: a **screen shake on flow**, driven by the same callback
that gates the rumble audio, so it fires when a mass is genuinely pouring rather than per
impact. A pile sliding past a perfectly static camera reads as polystyrene no matter how good
the maths underneath is.

### The shaft is bounded by the pillar, not by the board

Two related geometry errors, both visible once the rubble started behaving:

**The rubble did not follow the pillar.** The shaft's left wall was the board's left edge
(x=546), but the pillar's face sits at 578 and travels left to ~520 under full pressure. So the
harder the mass pushed, the wider the empty strip between the pillar and the rubble supposedly
pushing it — the causal story the whole game rests on, contradicted on screen. The left bound
now tracks `scene.pillarRight` every frame.

That opens a second problem: when the pillar springs back on the win, the wall advances *into*
the mass. Rocks behind it would sit outside the bounds where every move is blocked on both
axes, and freeze in mid-air. So a moving wall now shoves what is behind it (`pushRightOf`),
which is both what a wall physically does and a nice beat on the win.

And a third: with the bound left of the board, rubble overhangs the grid, where `solidAt`
reported open space and it fell through the scenery. The strip beside the board is the stone
ledge the grid is set into, so it now reads as solid floor — the overhang rests on it and rolls
toward the grate instead of vanishing.

**Rubble materialised mid-screen.** The inflow rect was placed relative to the board, several
cells above it, which is inside the frame. It is now driven from the layout
(`layout.edges.top - 40`) so new rubble always enters from just above the visible area at any
aspect ratio, and falls into shot.

### The threat became a force instead of a headcount

The sharpest note of the project: *"the debris fill the space as if it's empty — the logic
should be the debris are pushing each other and the pillar is pushed by debris. it doesn't work
like this in real life."*

That was a critique of the model, not the tuning, and it was correct. `pressure` was
`rockCount / capacity` — a **census**. The pillar moved because rocks existed, not because
anything pressed on it. Nothing in the simulation knew that a deep pile crushes and the same
rocks spread thin do not.

Replaced with an actual force chain. Every rock carries its own weight plus whatever is stacked
on it, and hands that total down to the rocks it rests on, split between them; load reaching the
floor leaves the system. One top-down sweep per frame. The pillar then feels the standard
granular result — a wall takes roughly `K` times the vertical load of the material touching it,
`K ≈ 0.45` for loose angular rubble.

It is a real force chain, not an approximation of one. It just skips the iterative solve a
rigid-body engine would run, which at this scale nobody can see.

Measured, and this is the whole point:

```
  rocks   wall force   force per rock
    111        6           0.06
    222       35           0.16
    389      147           0.38
    778      621           0.80
```

**Force is superlinear in rock count.** Doubling the rubble multiplies the push roughly sixfold,
because every rock at the base carries the column above it. A headcount can never express that,
and it is exactly what "the debris are pushing each other" means physically.

Two things fell out of it for free:

- **The win condition became honest.** A no-refill board strands ~11% of the mass on blocks that
  never clear. Under the census those rocks still read as danger, which is why the win threshold
  had to be set implausibly high (0.18) to be reachable. Scattered thin, they exert almost no
  force, so the threshold dropped to 0.06 and now means what it says: the mass no longer pushes.
- **Difficulty acquired a shape.** Pressure now stays low while the pile is shallow and ramps
  hard as it deepens, so the round has a real turn rather than a linear slide.

Rebalanced against it, and this time sweeping *player pace* as well as inflow — a threat clock
is meaningless without knowing how fast the player is:

```
                  0.9 moves/s   0.55 moves/s   0.4 moves/s
  crush 200 @20      97% win        77%            43%
  crush 260 @20     100% win        90%            77%
```

Shipped at crush 260 / inflow 20: a deliberate player taking ~2.5s a move still wins 77% of
rounds, a quick one always does, and failure stays genuinely reachable. Rounds run 9–16s of
play, which with human hesitation lands around 20–30s.

Guarded by tests that assert the physical claim rather than the numbers: that three times the
rubble pushes *more* than three times as hard, that force per rock rises with depth, and that
draining the mass releases the wall (31 → 0).

### Reviewing the rubble sim, and paying off its history

A read-through of `debris_sim.js` with fresh eyes, backed by instrumenting a 30-second run
rather than reasoning about the code. Three findings, all consequences of the same thing: the
rewrite to continuous occupancy was correct, but the previous model's machinery was left
standing beside it.

**The comments had become false, which is the worst kind of debt.** The header still said
"occupancy of SETTLED rocks only — a moving rock owns nothing", the exact inverse of the
invariant the file now depends on. A comment that lies is worse than no comment: it is what
the next person reasons from.

**Two wake policies, and the careful one was doing 5% of the work.** `_wakeAbove` checks
whether a rock has actually lost support before waking it — the fix that stopped the pile
churning. `_vacate` carried its own avalanche walk from the old model that woke unconditionally
and unregistered whole columns. Measured over 30s: **679 wakes from `_vacate`, 35 from
`_wakeAbove`.** The policy that had been reasoned about most carefully was nearly unreachable.
Deleted: releasing a cell notifies what rested on it, and if that rock falls its own `_reindex`
notifies the next one up. The cascade propagates itself — one rule instead of two.

**`_noCell` was a leak described as an edge case.** Its comment called it a rounding edge.
Measured: **834 additions, 22 resident** — about 5% of the mass unregistered at any moment, and
unregistered rocks are invisible to `_blocked`, so other rocks fell straight through them.

The root cause was a data structure that no longer matched the model: rocks are drawn wider
than a pack cell *on purpose*, so they overlap and two can legitimately land in one cell. A
one-rock-per-cell map cannot represent that, so the loser was dropped. Cells now hold a short
list, which deleted `_noCell` entirely along with `_occupy` (a one-line alias) and the `gx`/`gy`
fields on every particle.

**The refactor introduced a bug, and the tests caught it.** With several rocks per cell, each
was blocked by its own cell-mates — so a clump could never move again, and 15 rocks hung in the
air. Excluding `self` from the occupant list is not sufficient once a cell holds more than one;
a rock must never be blocked by the cell it is *standing in*, whoever else is in it. One line,
found because a test asserted the mass fully drains rather than that it looked right.

Net: fewer moving parts, one wake policy instead of two, and an invariant that is now actually
true — asserted directly by a test that every live rock is registered in the grid. Pile depth,
fall speed and the win/fail balance all measured unchanged afterwards.

Left deliberately: `_blocked` builds a template-string key on every call in the hottest path,
which is real allocation churn on mobile and would be worth a packed integer key; `_moveAxis`
takes a boolean flag argument; the constructor's `Object.assign` hides its field set. All noted,
none worth the risk this close to delivery.

### On borrowing an implementation

Two other playables were available as references for the rubble, and the option of lifting
their debris code came up both times. Neither was taken.

The first is a shipped ad creative whose physics is compiled into asset bundles. Shipping that
would mean putting someone else's code into a brief that prohibits exactly that. Its *config*,
however, is plain text and was extracted — and it confirms the tuning here already matches
(see below).

The second is an existing engine with a working granular-debris implementation. This project
was deliberately built from scratch rather than on top of an existing engine, so that the
result stands as original work; transplanting an implementation at the last minute would undo
the reason for that choice. Reading either one for *technique and constants* is reference
analysis, which the brief invites. Copying an implementation is not, and it is the same line
that got the placeholder art removed earlier.

The feel problem turned out to be a one-line regression in this codebase anyway.

### On the reference creative

The captured HAR was searched for the reference's rubble implementation. What is in it: one
4.1 MB HTML file whose payload is compressed asset bundles plus a config block. The config is
readable and confirms the tuning already in use here — `spinFPS 24`, `angleFPS 12`,
`angleDelta 10°`, `spinMovementThreshold 0.04`, flow gating at `speed 3 / minCount 10 /
cooldown 0.7 / startupIgnore 0.6`, four rock colours with per-rock base greys, and type
weights `28/28/15/29`. Every one of those matches what this project already does.

What is *not* in it is the collision and settling logic: that lives inside compiled bundles,
and lifting it would mean shipping another studio's code in a brief that prohibits exactly
that. The reference confirmed the tuning; the physics is ours.

### Size, honestly

At the end of this pass: **2.04 MB raw / 855 KB gzip**, one self-contained HTML file. (Audio, the
remaining UI art and later the character rig all landed after this and took it well past that. The
root [`README.md`](../README.md) carries the current figure — it is deliberately the only place
that does, so there is one number to update rather than six.)

Getting there took three separate things, and only one of them was compression:

| | |
| --- | --- |
| baking four static backdrop layers into one image | 10.5 MB → 3.0 MB of source |
| WebP at display resolution (`npm run art`, sharp) | whole art set 16.6 MB → 1.8 MB |
| narrowing two over-broad globs | **5.0 MB → 855 KB gzip** |

The last one dwarfed the other two, which is the lesson worth keeping: the build was carrying
megabytes of assets that nothing referenced. Compression only ever shrinks what you ship —
it does not stop you shipping the wrong things.

`tools/optimize-art.mjs` transcodes the extracted PNGs to WebP at twice display size. It is a
build-time tool (sharp is a devDependency, nothing in `src/` imports it) so re-running it
after an art change is one command and the PNGs stay the source of truth on disk.

Still carried and worth naming: **Three.js is ~151 KB gzip of the total for a rig that has not
arrived**. The loader is written and fail-soft, so the cost buys nothing until a `hero.glb`
lands. Removing it is one import if the rig slips.

## Verification of this build

A snapshot taken at this point in the log, not current figures — **State** at the foot has those.

```
npm install     clean
npm test        43 passed, 0 failed
npm run build   dist/index.html — 604 KB raw / 188 KB gzip, single file, no side assets
```

The **built file** was then opened in headless Chrome at `--force-device-scale-factor=2` —
both parts deliberate, for the two reasons above. Boots clean, no console errors, 6×8 board
laid out correctly, only the ad-SDK banner in the log. The capture shows an early frame
(character mid-drop, rubble not yet fallen), which is expected: these screenshots verify
layout, never motion.

### The plates, and what the rubble is actually falling through

Playtest note: *"the interaction with plates is broken — draining happens before the plates are
removed, and the plates are removed in the wrong way. They should stay in place and not
reshuffle."*

Three faults, and the third was hiding behind the first two.

**The wall was read from the rules, not from the screen.** `_solidAt` asked the match-3 grid
whether a cell was empty. The grid empties the instant a swap resolves — half a second before
the gem has finished shrinking and the plate has finished coming apart. The simulation was
falling through plates the player could still see. The wall is now its own `plateSolid` grid,
and the only thing that clears a flag is `_removePlate`, on the last frame of the crumble.
Order: swap 0.16s → gem 0.16s → plate 0.18s → hole.

**Match-3 gravity was moving the wall.** Survivors collapsed down their columns, so the empty
cells stacked at the TOP — the player opened a gap at row 4 and it appeared at row 0. Gravity
is gone: a match clears in place and no plate ever moves. That also removes the cascade, since
taking gems off a board can never complete a new line.

**The gates existed because of that gravity.** A column let rubble through once half of it was
cleared, regardless of which cells — a workaround for holes that never lined up, and the direct
cause of "draining before the plates are removed". With the gravity gone the workaround goes
too, and a hole is one plate.

Which surfaced the third fault. Six rows of plates is not a grate, it is six courses of masonry:
rubble sinks into a hole, lands on the plate below, and nothing ever leaves. Measured on the
real geometry with a bot that always takes the hint: **24 of ~430 rocks drained, and 20 rounds
out of 20 stalled into a fail.** The rules the player is given — match, the plate breaks, the
rubble pours through the gap — describe a grate, so the collision does too now: a rock whose
centre is already inside the panel got there through a hole, and the plates behind it cannot
stop it again. The flag is set once per frame from settled positions, because testing the live
position defeats itself — the rock has already been moved by the time the wall is asked.

Two constants had to be re-measured, because the change moved what they scale against.

`rawPressure` now cuts the force off at the grate surface. The pillar face runs y 325→561 and
the grate starts at 544, so rubble that has gone through is below the pillar entirely and
cannot push what it is no longer touching. Cutting there is what makes the pillar ease back as
the rubble pours rather than a beat later. `CRUSH_FORCE` then had to come down from 260, and
`ARM_AT` from 0.25 — at 0.25 a well-played round could finish having never armed, and 21 of 40
rounds simply hung. Swept at 40-60 rounds a cell:

```
                    1.1s/move   1.4s/move   2.5s/move   4.0s/move
  crush 260, arm .25   —           —         21 timeouts    —
  crush 260, arm .15   —          65%          50%         65%
  crush 180, arm .15   —          78%          78%         63%
  crush 130, arm .15  68%         65%          80%         72%     <- shipped
```

At the shipped values no round fails to resolve, the pressure meter uses its range (peak
averages 0.55-0.63), and a slow player is crushed rather than timed out — failure comes from
the threat again instead of from a stalemate rule.

### Two effects on one cleared cell, and why they are not one effect

The clear used to throw three untinted stone chips and nothing else. Four rounds of art
direction turned that into two separate effects, and the interesting part is why they had to
stay separate.

**Chips carry the gem's colour.** `step.cleared` already reported a `color` per cell, so it is
threaded through `_removePlate` into the burst. It has to come down from the cascade step
rather than be read off the board: the gem is gone by the time the plate breaks — that is the
`T_CLEAR` / `T_PLATE` split the rubble bug forced — so by then the grid has nothing to say
about what colour used to be there.

The tint is a **multiply**, and the chip art is warm sandstone (measured: mean RGB 228,190,126).
Red and green land true; blue has almost no base to multiply into and comes out teal. Lifting
each tint 25% toward white keeps the bodies from going muddy, and the highlights — which do
reach near-white in all three channels — carry the real hue. Getting a true blue would mean
neutralising the textures to grey at load, which needs a renderer handle passed into `Board2D`.
Not done: the shine ended up carrying the colour signal instead.

**The shine is white, not the gem colour, and that was a correction.** The first version tinted
the sparkles with the gem's colour too, on the reasoning that the star art is pure white and
therefore takes a tint exactly, so it was the one place the colour could read properly. Wrong
call — with both effects on the same hue the cell read as one flat wash. The chips carry the
colour; the shine carries the light, white through a light gold.

**They run on different rhythms, and that is the whole effect.** Chips land as one hit on the
plate-break frame. Sparkles trail in one at a time, 90 ms apart, starting a beat earlier on the
gem-clear frame — so the cell is still twinkling after the dust has settled. That stagger is
what makes it an echo instead of a second explosion, and it is why `shine.js` is its own
emitter rather than a second loop inside `_burst`: sharing one emitter forces one rhythm.

Cost is one container, one shared texture, and a pool of about a dozen sprites in a deep
cascade. `blendMode = 'add'` is set on the container, not per sprite, so the emitter stays a
single draw call.

**Sameness is a property of the burst, not of the pieces.** Playtest note: *"why do the
particles of the tiles burst the same way?"* — asked when every chip already randomised its
angle, size, spin, duration and texture. The constants were one level up: every burst threw
exactly 6 pieces, out of one point at the cell centre, in a fan symmetric about straight up, all
launched on the same frame. The eye counts silhouettes for free and reads the shape of the
spray before it reads any single piece. Fixing it meant per-*burst* randomness — 4–8 chips, the
fan tilted ±26° per burst, spawn scattered across 81% of the plate face, launches smeared over
50 ms. More per-chip randomness would have changed nothing.

Two tuning notes worth keeping. The chip size spread is flat and the sparkle spread is the
random *squared*: stone breaks into a bit of everything, but a sparkle field is mostly small
glints with an occasional big one, and a flat spread there gave three mid-sized blobs almost
every time — which is the thing randomness was supposed to fix. And the chips' 50 ms launch
smear is deliberately *not* a rhythm like the shine's 90 ms beat; same technique, opposite
intent, and they must not sync up.

**Asset note.** `sparkle2.png` is 256×256 and needed the WebP pipeline (12,451 → 1,216 bytes at
2× its draw size). The first candidate, `vfx_star.png` at 70×70, came out *bigger* as WebP
(375 → 602 bytes) — tiny and 87% transparent, so the container header dominates and there is
nothing left to compress. Neither is a PSD layer, so they cannot go through `layer()`, which
requires a `manifest.json` entry; effect art is placed by the code that spawns it.

## State at the end of this log

**Working end to end:** board, wall erosion, rubble inflow and drain, pressure→fail,
drained→win, retry, responsive fit, ad-SDK hooks, single-file build.

**Playable end to end, with the real art.** Scene composed from the PSD, board on its painted
recess, rubble in the delivered rock art, pillar driven by pressure with the hero riding it,
gem-tinted match chips and their shine echo, audio, stamina meter, tutorial hand, win and fail
end cards, retry, CTA. Portrait and landscape both reflow.

Everything after this point — the rigged character, the rope outro, the six-piece trap, the
stamina badge, the panic frame, the sound toggle, the CTA destination and the asset sweep — is in
[`04-finishing.md`](04-finishing.md). The two open items named below were both closed there.

**Known flake:** the debris suite is not deterministic. `debris_sim.js` calls `Math.random()` in
eleven places and its constructor takes no `rng`, unlike `Match3`, which accepts an injectable
one — so those tests run against fresh random input every time. Observed once as two failures,
not reproduced in 20 further runs, and the two failures were not captured. Still true, and still
worth fixing for the same reason the tests exist: an intermittent red makes a real regression
easy to dismiss as the flake.

**Placeholder, at the time of writing:** the character was the PSD's painted explorer rather than
the rigged glTF, which had not been delivered. `hero3d.js` was written fail-soft so the rig's
arrival would be a file drop rather than an integration. It arrived — see `04`.

**Not built, at the time of writing:** the rope beat of the outro, so the escape ran
pillar-release → run to door → end card. Also built in `04`.

Live counts and the current bundle size are in the root [`README.md`](../README.md) rather than
here, so there is one number to update rather than six.

## Character rig — the clip contract this log was written against

**Superseded. Kept because it is what the loader was built for, and the gap between it and what
arrived drove a real design change.** The delivered set and its measurements are in `PLAN.md` §3;
the change is in [`04-finishing.md`](04-finishing.md).

Budget: ≤5k triangles, one material, one 512² atlas, Draco off.

| clip | when it plays |
| ---- | ------------- |
| `fall` | the drop-in that seats him against the pillar |
| `brace_idle` | low pressure — planted, holding |
| `strain` | high pressure — blended against `brace_idle` by the pressure value |
| `fail` | pillar reaches the spikes |
| `win` | pillar retracts, he comes off the pillar |
| `jump` | pushes off toward the rope |
| `swing` | crossing to the door |

What actually shipped is `idle_0` / `idle_1` / `idle_2` / `push` / `land` / `rope` — three stamina
states rather than two blend endpoints, one landing clip, one pendulum, and no separate `fail` or
`win` clip at all. The `brace_idle`↔`strain` weight blend above is the assumption that did not
survive contact: adjacent delivered poses differ by more than 100° at the upper arm, so a partial
weight between them puts the limb through a midpoint that is not a pose. It became a three-state
machine with a cross-fade on transition.
