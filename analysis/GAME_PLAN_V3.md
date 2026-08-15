# Game Plan v3 — "Crushed" (2D puzzle + 3D intro)

---

## ⏱ RESUME HERE — state at end of 2026-08-11

**Working right now:** 2D Pixi gameplay runs end to end. 6×8 board with placeholder art,
rubble mass held on the wall, matches erode the wall and the rubble avalanches through the
holes and drains. Three renders the intro only, then stops completely.

```
cd playable
npm run dev                     # http://localhost:5173
                                #   ?skipintro  -> straight to gameplay
npm test                        # 43 headless tests (16 match3 + 27 debris), all passing
npm run build                   # 1.16 MB gzip
```

**Done:** B-1 delete 3D gameplay path · B-2 wire Pixi scene · B-4 inflow + grate drain
· logic half of B-5 (pressure→fail, drained→win) · rubble avalanche/settling rewrite.

**Next up: B-3 `plate.js`** — blocked on the user's Photoshop file with placements.
B-6 is blocked on B-3.

**Blocked on you:** the PSD (placements + assets), and the intro re-export once the chest
beat and fall exist.

**Bugs fixed today, worth not re-introducing:**
- `capacity` must always exceed the seeded rock count, or pressure starts at 1.0 and the
  player loses on their first match. Seed is now derived: `capacity × startFill`.
- The sim pool `max` must exceed `capacity`, or pressure can never reach 1.0 and the game
  can never fail. Now derived: `capacity × 1.15`.
- Pixi needs `autoDensity: true`. Without it the canvas renders at `720 × dpr` CSS pixels
  and everything is double-size and clipped on a retina display — **invisible in headless
  capture, which runs at dpr 1.** Use `--force-device-scale-factor=2` when checking layout.
- Rocks must not sleep on first contact, and must wake when their support vacates,
  otherwise the mass is a dead heap.

**Still open:** Q2 grid size (currently 6×8, must agree with the backdrop) · Q3 hero as
sprite frames vs 3D. Q1 is settled — **win = mass fully drained**.

**2026-08-13 — 3D intro parked, 2D scene now stands alone.** Focus is the match-3 loop;
the intro (2D or 3D) comes later.

- `scene3d.js` is **no longer imported** — kept on disk, marked PARKED at the top. Three.js
  therefore drops out of this bundle: **1.16 MB → 301 KB gzip**. Nothing was deleted; it
  returns automatically when the character module imports it.
- **The character will be a rigged 3D glTF, not sprite frames** (decided 2026-08-13). Pressure
  is continuous, so brace→strain must blend by animation weight; sprites would quantize it.
  Sprite frames stay available as a fallback — baking the same rig at packaging time is a
  file swap, not a rework. Budget: ≤5k tris, one material, one 512² atlas. Clips:
  `brace_idle`, `strain`, `fail`, `win`, `fall`. `#three-canvas` is reserved for it above
  the Pixi layer.
- **New `hero.js`** — placeholder figure + a <1s drop-in beat standing in for the intro.
  Tick-driven off the Pixi ticker, deliberately **not** GSAP: gameplay unlocks on landing,
  so that transition must never be able to stall. `_buildPlaceholder` is the only thing the
  real rig replaces. Placement is provisional pending the PSD.
- `?skipintro` **removed** — there is no cutscene left to skip. Clears a ship-checklist debt.

**🐛 Fixed: the production build was broken and had been for a while.** `dist/index.html`
booted to a black screen — `Cannot access 'browserAll' before initialization`. Cause: a
top-level `await` in `main.js`. vite-plugin-singlefile inlines everything into one module,
which turns Pixi's internal `import('./browserAll.mjs')` into a self-reference resolved by a
microtask; with the module body suspended at a top-level await, that microtask runs before
the `const browserAll` initializes. Fix: all async work moved inside `start()`, called
without awaiting. **`npm run dev` was never affected**, which is how it went unnoticed — so
check the *built* file, not just the dev server, before shipping.

**Build audit 2026-08-13 — `dist/index.html` = 762 KB raw / 292 KB gzip.** What's in it:
Pixi v8, GSAP, `@smoud/playable-sdk`, and **54 inlined images (138 KB, 19% of the file) that
are all third-party reference art**. Three.js is *not* in it.

- **Fixed:** `placeholder_assets.js` did `import * as THREE` for three exports nothing called
  (`loadRockAtlas`, `loadGemTextures`, `loadParticleAtlas`). Only tree-shaking kept Three out
  of the gameplay bundle. Removed → 301 → 292 KB gzip, and the 2D path no longer touches Three
  at all.
- **Open, needs your art:** ~1/5 of the shipped file is the publisher's copyrighted art. The brief
  requires original assets, so this must be swapped before delivery. The loader already fails
  soft (flat shapes) if the files are absent.
- **Repo bloat, not shipped:** `assets/ui/design.psd` is **111 MB and belongs to a different
  game** (layers read "UNTANGLE YOUR WEAPON", hero/enemy health bars). Also `world.blend1`
  (3.4 MB Blender backup), `world.glb.known-good-jun17.bak` (1.1 MB), and `src/world.glb`
  which duplicates `assets/blender/world.glb` byte for byte.
- **Unused but intended:** `assets/fonts` Baloo2 (2 MB) — the game still renders with
  `system-ui, Arial`. `assets/sounds` (509 KB, 23 files) waits on B-7 and will need a size
  budget once inlined.

**Verifying visuals headlessly:** rAF barely advances under `--headless` + SwiftShader
(<25 frames in 45s of virtual time), so screenshots catch an early frame and animation can't
be captured. Static layout is verifiable; motion needs a real browser.

The draft PSD (`ChatGPT Image Aug 11 …psd`, 1086×1448, 6 layers) is at the repo root and its
layout matches the locked design, but it reads 5×7 at 3:4 and **is not final** — B-3 stays
blocked. `world.blend` was re-saved after the last `world.glb` export, so the GLB may be stale.

---

> Written 2026-08-11 after the design pivot. **Supersedes the mechanic and scene sections of
> `REBUILD_PLAN.md`**; that doc's ship checklist (§7) and Blender contract (§2) still apply.
> Deadline **2026-08-15**. Code will be reviewed by Codex Luna — no dead code, no half-ports.

---

## 1. The design

**Threat:** a bank of **spikes fixed to the left edge** of the screen.
**Character:** braced against a **plate**, pushing back, feet planted — the classic ref pose.
**Pressure:** a **rubble mass** on the far side of the plate. The more rubble, the harder the
plate is driven left, into the hero, into the spikes.
**Puzzle:** the match-3 grid is the **grate the rubble is sitting on**. Clearing cells opens
holes; rubble pours through and drains away; the mass shrinks and the plate eases back.

### The causal loop (this is the whole game)

```
       rubble pours IN  (timer — the threat clock)
                 │
                 ▼
        mass on the grate ──────► plate pushes LEFT ──────► hero → spikes  = FAIL
                 │
                 ▼
       player matches 3 ─► block removed ─► hole in the grate
                 │
                 ▼
       rubble drains OUT ─► mass shrinks ─► plate eases back  = SURVIVAL
```

The player is racing **inflow against outflow**. Every match widens the drain. Nothing is
abstract: there is no rescue meter, no progress bar standing in for the fiction. The thing
that threatens the hero is the same thing the puzzle removes.

### Layout (portrait 720×1280)

```
┌──────────────────────────┐
│  logo            HUD     │
│                          │   ← rubble pours in from upper right
│ /|\                ▒▒▒▒  │
│ /|\  ☺  ▐▌  ▒▒▒▒▒▒▒▒▒▒▒  │   spikes | hero | plate ‖ rubble mass
│ /|\     ▐▌  ▒▒▒▒▒▒▒▒▒▒▒  │
├──────────────────────────┤
│   ▣ ▣ ▣ ▣ ▣ ▣            │
│   ▣ ▣ ▣ ▣ ▣ ▣            │   ← the grate = the match-3 grid
│   ▣ ▣ ▣ ▣ ▣ ▣            │
│   ▣ ▣ ▣ ▣ ▣ ▣            │
│        ↓ drains away     │
└──────────────────────────┘
```

Drama in the upper ~40 %, board in the lower ~50 % — matching the reference structure
(*"playable board (lower) + physics obstacle zone (upper)"*, `REFERENCE_ANALYSIS.md`).

### Pressure model — deliberately not a physics sim

```
pressure = clamp(rubbleOnGrate / CAPACITY, 0, 1)
plateX   = lerp(restX, crushX, pressure)
```

Rubble count *is* the pressure. No granular force propagation, no solver. It's honest
(the rocks you can see are the rocks pushing), it's one line, and it's frame-rate stable.

### Outcomes

- **FAIL** — `pressure` reaches 1: the plate pins the hero into the spikes.
- **WIN** — the grate is open enough that outflow beats inflow and the mass fully drains;
  on the last rock leaving, the plate springs back and the hero escapes. *(See Q1.)*
- **RETRY** — existing flow, unchanged.

### Intro (stays real-time 3D)

Scenic: the hero reaches for the chest, fingertips almost touching it — the floor gives way,
cartoon beat, he drops. **Cut on the fall** into the 2D chamber. The cut is covered by a
dust/black wipe so the 3D→2D switch is invisible.

---

## 2. Architecture

| File | Fate |
|---|---|
| `match3.js` | **Unchanged.** Pure rules, 16/16 headless tests. |
| `debris_sim.js` | Keep; add **inflow** + `countOnGrate()`. |
| `debris_pixi.js` | Keep. One base texture ⇒ one draw call. |
| `board2d.js` | Keep; integrate plate/pressure and the grate drain. |
| `scene3d.js` | **Intro only.** Stops rendering entirely at the cut. |
| `game.js` | Rewire: state machine, pressure→fail, drain→win. |
| `plate.js` | **New.** Plate + hero rig + spikes + pressure→transform. |
| `board3d.js` | **DELETE.** |
| `debris_sprites.js` | **DELETE.** |

Two renderers exist, but never both hot: Three runs the intro, then stops; Pixi runs the
whole interactive portion. That's the single biggest perf win available to us.

---

## 3. Asset spec — everything you produce

Design resolution **720 × 1280**. WebP preferred, PNG fine. Greyscale where noted (tinted at
runtime — free re-palette). Placeholders from `_placeholder_thirdparty/` stand in until each
lands, so **nothing here blocks code**.

| # | Asset | Spec | Notes |
|---|---|---|---|
| A1 | `bg_chamber` | 720×1280 | full backdrop, lit and rendered in Blender — bake the beauty, zero runtime cost |
| A2 | `fg_overlay` *(optional)* | 720×1280, alpha | foreground pillars / vignette for depth |
| A3 | `spikes` | ~140×900, alpha | anchored to the left edge, vertically centred |
| A4 | `plate` | ~110×520, alpha | anchor centre; slides horizontally only |
| A5 | `hero_*` frames | ~320×420 each, alpha | **brace loop** (8–12), **strain** (high pressure), **fail**, **win/cheer**. Pre-render from the rig — same trick as the rocks |
| A6 | `block` | 128×128 | one grate cell; optional `block_cracked` |
| A7 | `gems_atlas` | N×128 strip, 128 tall | **3 tiles**, left→right, distinct silhouettes |
| A8 | `rocks_atlas` | 1820×560 (13 cols × 4 rows of 140²) | **greyscale**, each row a looping tumble (frame 13 ≈ frame 1) |
| A9 | `fx_atlas` | small, white on alpha | circle, star, ring, sparkle, streaks — tinted at runtime |
| A10 | UI kit | — | buttons, end card, logo, HUD frame |
| A11 | 3D intro scene | `world.glb` | chest beat + fall; export with `_export.py` (**Draco OFF**) |

---

## 4. Task list

### Track A — art (you)

- [ ] **A-1** Intro scene: chest beat, floor give-way, cartoon fall → re-export GLB
- [ ] **A-2** 2D chamber backdrop (A1, A2)
- [ ] **A-3** Spikes + plate (A3, A4)
- [ ] **A-4** Hero frames (A5) — brace / strain / fail / win
- [ ] **A-5** Block + gems (A6, A7)
- [ ] **A-6** Rock atlas (A8) — greyscale turntable renders
- [ ] **A-7** FX + UI (A9, A10)

### Track B — code (me)

- [x] **B-1** Delete the 3D gameplay path (`board3d.js`, `debris_sprites.js`) ✅
- [x] **B-2** Wire the Pixi gameplay scene; stop rendering Three at the cut ✅
- [ ] **B-3** `plate.js` — plate + spikes + hero rig, pressure→transform ⟵ **NEXT, needs PSD**
- [x] **B-4** Rubble inflow (threat clock) + drain through the grate ✅
- [ ] **B-5** Rewire outcomes: pressure→FAIL, full drain→WIN, retry — *logic done, visuals need B-3*
- [ ] **B-6** 3D→2D transition with dust/black wipe — *blocked on B-3 and A-1*
- [ ] **B-7** Audio: flow gate, 6 round-robin match variants, stingers
- [ ] **B-8** Tutorial mask (dim all but the hinted pair) + hint
- [ ] **B-9** HUD, end card, CTA
- [ ] **B-10** Balance pass once inflow/capacity are tunable
- [ ] **B-11** Packaging: strip `?skipintro`, placeholders, harness; README, ai_logs, walkthrough

### Source map (as of 2026-08-11)

| File | Role |
|---|---|
| `src/match3.js` | pure grid rules — no renderer, no DOM |
| `src/debris_sim.js` | pure rubble sim — avalanche, settling, rolling, inflow, drain |
| `src/debris_pixi.js` | renders the sim; one base texture ⇒ one draw call |
| `src/board2d.js` | Pixi board: layout, art, input, wall erosion, pressure |
| `src/scene3d.js` | **intro only** — stops rendering at the cut |
| `src/game.js` | state machine, outcomes, SDK lifecycle |
| `src/placeholder_assets.js` | ⚠️ third-party placeholder loader — delete at packaging |
| `test/*.test.mjs` | 43 headless tests, `npm test` |

### Handoffs

Code never waits on art — every slot has a placeholder. Art lands as a **file swap**.
The one true dependency is **A-1 → B-6**: the transition can't be timed until the fall
animation exists.

---

## 5. Open questions

- ~~**Q1 — Win condition.**~~ **RESOLVED 2026-08-13: mass fully drained.** The moment the last
  rock leaves the grate the plate springs back and the hero escapes — visually definitive and
  causally honest. This is the balance target: outflow must be able to beat inflow once enough
  of the grate is open. (Rejected: survive N seconds, clear X % of the grid.)
- **Q2 — Grid size.** 2D means we choose. Currently **6 × 8**. It must agree with A1's backdrop,
  so decide it while designing the chamber. **Deferred 2026-08-13** — the draft PSD reads 5 × 7,
  but the user says it is not ready; do not resize until the final layout lands.
- **Q3 — Hero in the 2D scene.** Recommend **pre-rendered sprite frames** (A5). Confirm, since
  it's your work either way.
- ~~**Q4 — Geometry check.**~~ **RESOLVED 2026-08-11:** placement is **the same as the 3D
  scene**, with spikes and the plate added. The grid is the wall; the rubble rests on top of
  it and drains **downward** through cleared cells; the plate is the left wall of the rubble
  mass, with the hero and then the spikes beyond it. This is already what `board2d.js` does —
  no rework. The user is producing a **Photoshop file with all placements and assets**, which
  becomes the layout source of truth.

---

## 6. Schedule

| Day | You | Me |
|---|---|---|
| **Aug 12** | A-2, A-3 (chamber, spikes, plate) | B-1, B-2, B-3, B-4 — full loop playable with placeholders |
| **Aug 13** | A-4, A-5, A-6 (hero, blocks, rocks) | B-5, B-7, B-8 — outcomes, audio, onboarding |
| **Aug 14** | A-1, A-7 (intro, FX/UI) | B-6, B-9, B-10 — transition, HUD, balance |
| **Aug 15** | review | B-11 — packaging + deliverables |

Feature freeze **Aug 14 EOD**. Aug 15 is packaging only.
