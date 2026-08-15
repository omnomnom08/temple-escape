# Work Log — Reference Video Analysis

> Running log of everything done to analyze the `references/` videos and build the game-flow understanding doc.

## 2026-06-16

### Setup
- Listed `references/`: `ref-1.mp4`, `ref-2.mp4`, `ref-3.mp4`, `ref-4.mp4` (+ macOS `.DS_Store`).
- `ffmpeg` / `ffprobe` not installed. Installed **Gyan.FFmpeg 8.1.1** via `winget`.
  - Binary path: `C:\Users\Dasha\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin`
  - PATH not refreshed in current shells; using full path / per-session `$env:Path` prepend.
- Probed metadata for all four videos:

| File | Resolution | Aspect | FPS | Duration | Frames |
|------|-----------|--------|-----|----------|--------|
| ref-1.mp4 | 1080×1920 | 9:16 | 30 | 59.86s | 1795 |
| ref-2.mp4 | 720×1280  | 9:16 | 30 | 60.01s | 1800 |
| ref-3.mp4 | 720×1280  | 9:16 | 30 | 61.48s | 1843 |
| ref-4.mp4 | 720×1280  | 9:16 | 30 | 59.11s | 1770 |

All are vertical mobile-format clips ~60s long — consistent with **playable / video ad creatives**.

### Plan
1. Extract frames at 2 fps (every 0.5s) per video → `analysis/frames/ref-N/`.
2. Launch one analysis agent per video to read frames sequentially and describe flow, UI, and visuals.
3. Synthesize findings into `analysis/REFERENCE_ANALYSIS.md` (the understanding doc).
4. Keep appending to this log.

### Frame extraction
- Ran `ffmpeg -vf "fps=2,scale=540:-1" -q:v 3` on all four videos → `analysis/frames/ref-N/f_%03d.jpg`.
- Results: ref-1 = 120, ref-2 = 120, ref-3 = 123, ref-4 = 118 frames. Mapping: `f_NNN` ≈ `(NNN-1)×0.5s`.
- Chose 2fps as the sweet spot: dense enough to capture every scene/UI transition, light enough that one agent can read a full video (~120 images) in one pass.

### Parallel frame analysis (4 agents)
- Launched **4 `general-purpose` agents simultaneously**, one per video. Each instructed to Read every frame and return a structured report (overview, timeline, mechanic, UI, visual style, win/fail/reward, end card, notable details) with frame+timestamp citations.
- All four completed successfully (tool_uses ≈ frame counts; ~85k–120k tokens each).
- **Unanimous finding:** all four are creatives for the **same title, from the same publisher**, following the same "save the King" fake-gameplay funnel → deliberate **FAIL** → "[TITLE] / Play Now!" end card.
- Saved each full report to `analysis/per-video/ref-1.md … ref-4.md`.

### Hand-verification of key frames
- Read 5 critical frames directly to ground-truth the synthesis:
  - `ref-1/f_020` — confirmed match-3 board (red gummy / green spade / gold crown), pointing royal-cuff hand on a tile, rubble channel + king in alcove + snake top-left.
  - `ref-1/f_094` — confirmed FAIL screen (glossy red button, gold rim, white "FAIL", blurred gameplay behind).
  - `ref-1/f_105` — confirmed end card (3D "[TITLE]" logo, 2×3 grid of 6 yellow-bordered animated hazard vignettes, green "Play Now!" pill, no store badges).
  - `ref-2/f_001` & `f_030` — confirmed gold-ball pile pushing king toward gold spikes + radial **flexed-bicep "strength" timer** (green→orange→red).
- Resolved the one inter-agent disagreement (tap vs. swap): refs 1/3/4 read as tap-to-clear, ref-2 as swap. Documented both; recommended tap-to-clear for our build.

### Read the assignment PDF
- User pointed to `pdf/Home Assignment Sett – Generalist Technical Artist.pdf`. Read all 3 pages.
- **Goal clarified:** build an *original* browser "Save the Character" playable ad (Three.js/Pixi.js + Vite + Node LTS), reference creative-level quality/readability, **no copying, no copyrighted assets**. Must have character-in-danger, threat, simple save interaction, **success + failure**, **retry**, strong feedback, 3-second readability; portrait/mobile, lightweight; deliverables `/playable /assets /ai_logs /walkthrough.mp4 /README.md`.
- Re-framed the understanding doc around this: references = quality/mechanic/readability **target**, not a clone target. Added KEEP-vs-CHANGE, a recommended original concept, and a requirements-traceability matrix.

### Deliverables produced
- `analysis/REFERENCE_ANALYSIS.md` — master understanding + build guide (anatomy, mechanic, hazards, pacing, visual language, FAIL/end-card specs, readability rules, KEEP/CHANGE, recommended concept, traceability, asset index).
- `analysis/per-video/ref-1.md … ref-4.md` — full per-video frame reports.
- `analysis/frames/ref-N/` — extracted frames (kept for re-reference).
- `analysis/WORK_LOG.md` — this log.

### Build approach + asset decisions (user Q&A)
- Asked the user 3 scoping questions. Answers: **render = Three.js (scene) + Pixi.js (tiles)**; **theme = cartoony Indiana-Jones-style explorer**; **art = free/CC0 packs**.

### Open-source foundation research
- Web-searched for legitimately open-source playable-ad foundations on our stack.
- Best fit: **`@smoud/playable-scripts` + `@smoud/playable-sdk`** (both **MIT**): official **Pixi *and* Three** templates, MRAID/~20 networks, lifecycle `start`/`finish`/`retry` + `sdk.install()` CTA. Latest v1.0.38. Caveat: scripts pkg is **webpack** (no Vite).
- Other candidates: `turbokirichenko/pixijs-typescript-vite-template` (Pixi8+TS+Vite, generic, no playable layer); `eXponenta/pixi5-playables-boilerplate` (Pixi v5, old); `doinel1a/vite-three-js` (MIT, Three+Vite, no playable layer).
- Confirmed **`@smoud/playable-sdk`** is **bundler-agnostic** → usable on a Vite stack. API verified: `sdk.init/start/finish/install`, events `resize|retry|volume|interaction`.

### Foundation decision (user-selected)
- **Path B: fresh Vite stack** — Pixi v8 (board/UI) + Three (scene) + **`@smoud/playable-sdk`** (MIT, MRAID/lifecycle/CTA) + **`vite-plugin-singlefile`** (single-HTML output). All open-source/MIT. Recorded in memory `foundation-decision`.

### Deliverable added
- `analysis/BUILD_PLAN.md` — execution roadmap (8 phases), architecture/file layout, SDK integration, **CC0 asset-preparation checklist** with sources/specs/size budget, open decisions, risks, deliverables mapping.

### Status: PLAN READY
Awaiting (non-blocking) confirmation of: hazard (lava/snake/walls), match interaction (tap vs swap), character fidelity (3D vs 2.5D), and game name. Next actionable step: **Phase 0 — scaffold the `/playable` Vite project**.

### Phase 0–2 — runnable demo scaffolded (`/playable`)
- Created fresh Vite project `playable/`: `package.json`, `vite.config.js` (+ `vite-plugin-singlefile`), `index.html` (fixed 720×1280 design res, scale-to-fit responsive), `src/main.js`, `src/scene3d.js`, `src/board.js`, `src/game.js`.
- Stack installed: **three ^0.180, pixi.js ^8.6, gsap ^3.12, vite ^5.4, vite-plugin-singlefile ^2.0**, + **@smoud/playable-sdk ^1.1.1** (installed separately; imported defensively so the demo also runs standalone).
- **Demo concept (vertical slice):** "Temple Escape" — explorer stranded on a pillar above **rising lava** (Three.js scene). Tap connected groups of 2+ same-color tiles on the Pixi board → each clear **drains the lava + fills the RESCUE meter**. Lava auto-rises (timer-by-proxy). Reach RESCUE 100% before LAVA hits 100% → **WIN** ("SAVED!" + Play Now! CTA); lava wins → **FAIL** ("OH NO!" + Try Again). Retry resets. SDK lifecycle wired: `start`/`finish`/`install`/`retry`.
- Engine split realized: **Three** = scene (explorer/pillar/lava/lights), **Pixi** = board + HUD + overlays + FX, layered canvases.
- Ran `npm run dev` (Vite v5.4.21 on **http://localhost:5173/**). Verified: index + all modules transform HTTP 200; deps pre-bundled OK (incl. `@smoud_playable-sdk`).
- **Visual verification:** captured headless Chrome screenshots (swiftshader WebGL); iterated framing twice (camera pull-back; removed an ugly exit-arch slab → subtle light shaft). Final composition reads cleanly: danger scene top, board bottom, LAVA/RESCUE meters, tutorial cursor. No runtime errors.

### Status: DEMO RUNNING
Playable demo live at http://localhost:5173/ (dev server running in background). Uses code-drawn placeholder visuals — CC0 art assets (per `BUILD_PLAN.md` §4) not yet integrated.

### Design correction + setting locked (user feedback after re-watching refs)
- **Core mechanic corrected:** it is true **match-3** (swap to align **3+**), and matched tiles are **permanently removed — no refill / no respawn**. The **block field IS the obstacle** in the hero's escape path, so clearing blocks **directly frees the character** (no abstract "rescue meter"). The first demo was wrong on both counts (tap groups of 2 + infinite refill + meter).
- **Setting locked:** **real-world ancient-temple / jungle-ruins adventure** with an original **Indiana-Jones-archetype explorer** (fedora, whip, leather jacket, satchel) — chosen for recognizability + better ad metrics.
- Saved the user's art-direction image → `analysis/art-direction/explorer-setting-reference.png` (**internal inspiration only**; we ship original assets + own branding, no third-party logo or character).
- Wrote authoritative spec `analysis/GAME_DESIGN.md` (setting, character, corrected match-3 mechanic, threat, outcomes, readability, rebuild implications). Updated `BUILD_PLAN.md` locked-decisions table and added a correction note to `REFERENCE_ANALYSIS.md` §3. Recorded in memory `game-design`.

### Status: SPEC UPDATED — demo rebuild pending
Next: rebuild `board.js` + `game.js` to the corrected match-3 (permanent removal, no refill, block field = obstacle, direct path-opening) and reskin to the temple/explorer setting.

### Demo rebuilt to corrected mechanic + temple reskin
- **`board.js` rewritten:** true **match-3** by **swap** (drag a block onto a neighbour); aligns of **3+** clear; matched blocks **permanently removed — no refill / no respawn**; gravity collapse within columns; cascade resolution; **reshuffle leftovers** if no move remains; `findHint()` for the tutorial cursor. 6×6, 5 gem colors, safe initial fill (no auto-matches).
- **`scene3d.js` reskinned:** warm temple — sandstone block walls, central pillar, animated **torches** (flicker + point lights), a **golden exit doorway + glow** at the top (the goal), rising **lava** plane (emissive). Explorer upgraded to the **adventurer**: fedora, brown leather jacket, light shirt, satchel strap. Shaft parameterised in normalised height `s`; `setHeroProgress`/`setLavaProgress` map to the visible band above the board; `isCaught()` = lava reached hero.
- **`game.js` rewritten — corrected coupling:** explorer climb height = `clearedFraction / WIN_FRACTION` (no abstract rescue meter — clearing the blocks IS the rescue). Lava rises on a timer (`LAVA_RATE`). **WIN** when explorer reaches the exit; **FAIL** when lava catches him; **HURRY!** warning when lava nears. Retry resets field + lava + hero. SDK `start`/`finish`/`install`/`retry` wired. Tutorial cursor animates a real swap (`findHint`).
- **Tuning constants** (top of files): `LAVA_RATE=0.040`, `WIN_FRACTION=0.62` (game.js); shaft band `Y_BOTTOM/Y_TOP`, `HERO_S0/S1`, explorer scale (scene3d.js).
- **Verified** via headless Chrome screenshots; iterated the shaft height-mapping + explorer scale so the explorer sits clearly in the visible gap between the lava and the golden exit. Modules transform HTTP 200; no load errors. Live at http://localhost:5173/.

### Physics-debris spike (3D colliding cubes)
- User wants the references' satisfying 3D debris done *for real* (instanced + physics with chunk-vs-chunk collision), capped ~50–100, and is open to redesigning the scenario around it.
- Reviewed dense frames (`analysis/particle-study/`, since deleted): the refs' "satisfying particles" are **granular piles** (gold balls / stone rubble / buttons) draining with physics — not sparkle FX. Confirmed real-physics is the right call for that look.
- Built spike: new `src/debris.js` — `DebrisField` using **cannon-es** (added dep). Pooled, hard cap **80** box bodies, full collision incl. chunk-vs-chunk, sleeping on (`allowSleep`, settled cubes ≈ free), SAP broadphase; rendered as a single **InstancedMesh** (1 draw call, `frustumCulled=false`, per-instance color). Contained in a static 5-wall bin so cubes pile. Bodies pre-allocated (no per-burst GC); oldest recycled at cap; cull below y<-3.
- Wired: `board.js` passes cleared color to `onClear(count, color)`; `game._onCleared` fires `scene3d.burstDebris(count*3, color)`; `game.update` calls `scene3d.stepDebris(dt)` + shows an **FPS + live-cube** readout (top-right). `/?spike` debug hook auto-fires bursts for stress-testing.
- Verified via headless screenshot: 80 cubes burst, collide, and **stack into a real pile** — physics + instancing confirmed working. (Headless FPS is meaningless — swiftshader/software WebGL; real GPU perf must be judged in-browser.)
- Note: spike bin is centered over the scene (overlaps explorer) — placement is just for the stress test; final design would position it (e.g. a counterweight bucket to the side).

### Status: DEMO v2 + DEBRIS SPIKE (awaiting perf/feel verdict)
### Status: DEMO v2 RUNNING (corrected mechanic)
Match-3 / permanent-removal / climb-to-exit demo running. Still code-drawn placeholders (CC0 art per `BUILD_PLAN.md` §4 not yet integrated). Win/fail overlays wired (same proven pattern) but not yet verified through a full headless playthrough — needs interactive playtest + balance tuning.

