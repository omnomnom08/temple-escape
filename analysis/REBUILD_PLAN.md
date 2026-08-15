# Rebuild Plan — 4-day run to delivery

> Written 2026-08-11. Supersedes the scene/debris parts of `BUILD_PLAN.md` §3 and the Stage-B notes.
> `CORE_MECHANIC.md` (2D grid → 3D blocks → world reacts) still holds. What changes is **Layer C**, the debris tech, and the scene layout.

---

## 0. Where we actually are

Code last touched 2026-06-17. Playable runs end-to-end (intro cutscene → match-3 on the 3D wall → win/fail → retry, SDK wired), but four systems are decoupled and that's what makes it feel wrong:

| Symptom | Root cause |
|---|---|
| Clearing blocks feels disconnected from the rescue | `setHeroProgress` lerps the hero along a rail from `clearedFraction / 0.62`. *Where* you clear is irrelevant — it's the abstract rescue meter `GAME_DESIGN.md` told us to kill, renamed. |
| Falling cubes do nothing | Debris detaches, drops to `floorY`, stacks per column, and never touches the hero, threat, or win condition. **Scrapped.** |
| Failing feels arbitrary | Spikes advance on `LAVA_RATE` with zero relationship to the board. |
| Board dies late-game | No collapse + no refill ⇒ holes are permanent and scattered; surviving gems fragment until 3-in-a-line is impossible and `_reshuffle()` fires constantly. See **D1**. |

---

## 1. Decisions locked 2026-08-11

| # | Decision |
|---|---|
| **L1** | **Debris = 2D billboard sprites**, not 3D cubes, not a physics engine. 4–5 hand-authored rock frames; frame chosen by **speed** (fast = smeared, slow = crisp, resting = settled). One `InstancedMesh` of a single quad, per-instance UV offset + rotation + scale, unlit material, **1 draw call**. Target 200–400 particles. Justification: the gameplay camera is locked straight-on, so billboards are visually indistinguishable from geometry — and sprites are the only way to get the references' *granular* rubble look. |
| **L2** | **Art leads.** The user re-authors the scene layout in Blender; the level-design causal link (what clearing the wall physically does) is decided there. Code binds to whatever the new scene says — see the contract in §2. |
| **L3** | **Threat stays a pure timer** (as in the references). No puzzle coupling. Needs rebalancing only, so a win is actually reachable. |
| **L4** | `cannon-es`, `src/debris.js`, `src/board.js` are **deleted**. No physics engine ships. (Confirmed by the shipped reference config: their class is literally `CustomPhysicsController` — a hand-rolled solver.) |
| **L5** | Tuning follows the **shipped reference parameters** extracted in `SHIPPED_CREATIVE_CONFIG.md` rather than being invented: 3 gem colors, 4 weighted rock variants from one greyscale sheet, quantized spin/angle, threshold-gated flow audio, 50 Hz fixed step, gravity −10. |

---

## 2. Blender authoring contract ⟵ *read before touching the scene*

The code reads the GLB by **node name** and by **geometry regularity**. Break either and `scene3d.js` / `board3d.js` stop binding. Everything below is a hard requirement unless marked *optional*.

### 2.1 The match grid — hard constraints
- Tile cubes must stay a **clean rectangular lattice**: axis-aligned, **uniform spacing**, all cubes the same size. `board3d.js` recovers rows/cols by clustering world positions with a 0.25 tolerance — irregular spacing silently produces a wrong grid.
- Keep the naming prefix **`tile_cube_0*`**, and keep the collider template under **`physical_objects`** (it's excluded by ancestor name).
- **6 columns × 8 rows** unless you tell me otherwise; the code reads the count, but balance is tuned to 48 cells.
- The grid must face the gameplay camera **straight-on**. Raycast picking and gem billboarding both assume it.

### 2.2 Required named markers
Keep these names, or send me the new ones — each is read explicitly:

| Name | Used for |
|---|---|
| `point_camera_start_0` | intro establishing shot |
| `point_camera_0` | the fall beat |
| `point_camera_1` | **gameplay camera** (straight-on at the wall) |
| `hero_point_start_0` / `_1` | upper-room walk start / breakable-floor spot |
| `hero_point_1` | landing spot = gameplay start |
| `point_fire_0/1/2` | torch point-lights |
| `body_placeholder` | hero stand-in |
| `spikes` | threat mesh (translates on the timer) |
| `physical_walls`, `physical_objects` | hidden helpers |
| `vfx_scale`, `vfx_spin_0/1` | win-burst anchors |

### 2.3 New markers this rebuild needs
- **`debris_spawn`** *(or per-column `debris_spawn_0..5`)* — where sprite rubble is born. **Required.**
- **`debris_floor`** — the resting plane for settled sprites. **Required.**
- **`hero_path_0..N`** — an explicit ordered path for the hero instead of a 2-point lerp. **Required.** However many waypoints the escape needs; I'll drive him along them.
- **`exit_point`** — where reaching = WIN.
- Whatever the causal link needs: if the wall **holds something back**, add an anchor for it (`held_object` / `water_plane`); if the hero **climbs a pile**, mark `pile_base` + `pile_top` so I can map pile height to climbable height.

### 2.4 Budget constraints (these bite at package time)
- **Textures: 512² WebP.** Current sources are 2 MB+ PNG/JPEG (`texture_wall_0/1`, `texture_gate`) — they alone would blow the ≤3 MB single-file cap.
- Total inlined bundle target **≤3 MB**; current build is 2.67 MB raw / ~1.0 MB gzip with a 1.11 MB GLB.
- Keep the polycount low and **avoid geometry that needs shadow casting** — the shadow map is a bigger perf cost than the debris ever was.
- Re-export with `assets/blender/_export_final.py` → copy to `playable/src/world.glb`. **`world.blend` was edited 2026-06-17 15:35, after the last export at 07:42 — the shipped GLB is already stale.**

---

## 3. Code workstreams (layout-independent)

> **Status 2026-08-11 — W1, W2, W3 done and verified.** New file layout:
> `match3.js` (pure headless rules) → `board3d.js` (thin view/binding) → `debris_sprites.js` (particles).
> The split matters: the scene redesign now only touches `board3d.js`, and the match rules
> can be tested with no browser at all. 16/16 headless logic tests pass; the debris shader
> was verified in isolation (1 draw call, `glError=0`, 180 rocks settling, flow hook firing).
> `board.js`, `debris.js` and the `cannon-es` dependency are gone. Build: 2.68 MB / **1.02 MB gzip**.
> `_debris_test.html` is a dev-only harness — delete it at packaging.

**W1 — Sprite debris system** (`src/debris_sprites.js`, replaces `debris.js`)
`InstancedMesh(PlaneGeometry, count)`; per-instance attributes: `frame`, `rotation`, `scale`, `tint`. Scripted motion — gravity + drag, no solver. Pooled, capped, settled particles frozen and recycled oldest-first.
Built to the teardown numbers (`SHIPPED_CREATIVE_TEARDOWN.md` §1): **4 rock shapes × 13 greyscale frames** as a looping tumble at ~24 fps, rotation quantized to **10° at 12 fps**, freeze below speed **0.04**, `_BaseGrey`/`_TintColor` tint shader.
Needs from you: **4 rock shapes × 13 frames, 140², greyscale, webp** — a Blender turntable render (~85 KB total), *not* hand-painted variants.

**W2 — Board logic fix** (`board3d.js`) — see **D1** below.

**W3 — Dead code + deps** — delete `board.js`, `debris.js`, drop `cannon-es`. (~510 lines gone.)

**W4 — Audio** — nothing exists today; 24 SFX sit unused in `assets/sounds`. Small `Audio.js` wired to `sdk.on('volume')`: match pop, rubble crash, threat rumble, win, fail, click. Highest juice-per-hour on the whole list.

**W5 — UI pass** — `assets/ui/design.psd` (117 MB) has never been sliced. Needs export to a small atlas + Baloo2 subset (currently everything is `system-ui` and code-drawn rects).

**W6 — Package** — GLB re-export, texture compression, single-file build, `README.md`, `/ai_logs`, `walkthrough.mp4`.

---

## 4. Four-day schedule

| Day | You (art) | Me (code) |
|---|---|---|
| **Day 1 — Aug 11** | Re-author scene layout in Blender to §2; decide the causal link | W1 sprite debris (against the current scene), W2 board fix, W3 cleanup |
| **Day 2 — Aug 12** | Rock sprite sheet + gem art; first GLB re-export | Bind `scene3d.js` to the new markers; hero path; wire debris to the new layout |
| **Day 3 — Aug 13** | UI slice from `design.psd`; hero character (or we ship the placeholder — see R1) | W4 audio, W5 UI, balance pass, juice |
| **Day 4 — Aug 14** | Review / final art fixes | W6 package, texture compression, README, ai_logs, walkthrough capture |

Delivery **Aug 15**. Day 4 is packaging only — treat Day 3 EOD as feature freeze.

---

## 5. Open decisions

**D1 — how the board avoids starving (mine to implement, needs your nod)**
Today a match removes the gem *and* its cube together, so surviving gems and surviving cubes stay 1:1 per column — meaning there is no free space to collapse into and the grid can only fragment. My recommendation:

> **Gems collapse downward with gravity (classic match-3, still no refill), and the column's wall loses its cubes from the TOP.** Cleared 3 in column 4 ⇒ column 4's top 3 cubes fall away as sprite debris, remaining gems compact to the bottom.

Counts stay consistent per column, gems stay densely packed and matchable, no refill rule is preserved, and the wall visibly **shrinks from the top** — which reads instantly as "the barrier is coming down." It also gives the debris a clean, believable source.

**Second half of the fix, from the extracted config:** drop from **5 gem colors to 3** (the reference ships 3 for phases 1–2 on a *larger* 7×10 board). Five colors on 48 no-refill cells is arguably a bigger cause of the starvation than the collapse rule. One-line change, do it first. See `SHIPPED_CREATIVE_CONFIG.md` §3.

**D2 — hero character.** Still `body_placeholder`. Biggest readability gap: "character in danger" currently reads as a grey blob. Decide by Day 3 whether real art lands or we ship a stylized placeholder.

**D3 — win condition.** Currently `clearedFraction ≥ 0.62`. Once the causal link is authored this should become spatial ("the path is open" / "the pile is high enough") rather than a percentage.

---

## 7. Ship checklist — REMOVE BEFORE PACKAGING

Dev-only scaffolding that must not reach the deliverable:

- [ ] **`?skipintro`** — `SKIP_INTRO` const + the bypass block in `game.js` (`_enterIntro`). Added 2026-08-11 at the user's request to skip the cutscene while iterating; it also unblocks headless capture, where GSAP's rAF doesn't advance. **Delete both, and the console warning.**
- [ ] **`_debris_test.html`** — standalone debris harness in `playable/`. Not referenced by the build (Vite only takes `index.html`), so it won't ship in `dist/`, but delete it from the source tree.
- [ ] **`assets/_placeholder_thirdparty/` + `src/placeholder_assets.js`** — ⚠️ **the big one.** Third-party reference art (52 rock frames, gem sheet, particle atlas), pulled in 2026-08-11 at the user's request so gameplay could be tuned against real-quality assets. **This art is currently compiled into `dist/`.** The brief forbids copyrighted assets. Replace with our own renders (contract is identical — see that folder's README), then delete the module. Both loaders `console.warn` while active.
- [ ] Anything under `reference-bundle/` must never reach `dist/` — reference material only, and it's third-party copyright.
- [ ] `console.info`/`console.warn` diagnostics in `board3d.js`.

## 6. Risks

- **R1 — Blender work is the critical path.** Everything from Day 2 on binds to it. If the layout slips past Day 2, I bind to the current scene and we ship that. Mitigation: §2 contract exists so authoring and coding can run in parallel.
- **R2 — Texture budget.** 2 MB+ source textures vs a ≤3 MB total cap. Must be 512² WebP; don't author detail that survives only at 2K.
- **R3 — Marker renames.** Silent breakage — the loader returns `null` and things sit at the origin. Tell me any rename.
- **R4 — Scope.** Audio, UI, hero art, and packaging are all still open with 4 days left. If something must go, it's the hero character (D2), not audio (W4) — audio buys more perceived polish per hour than anything else on this list.
