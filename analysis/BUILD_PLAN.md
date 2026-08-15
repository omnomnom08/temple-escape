# Build Plan — "Save the Character" Playable Ad

> Companion to `analysis/REFERENCE_ANALYSIS.md` (design DNA) and `analysis/WORK_LOG.md` (process log).
> This plan is the **execution roadmap + asset shopping list**.

---

## 0. Locked decisions

| Area | Decision |
|------|----------|
| **Foundation** | Fresh **Vite** project (matches brief). **Pixi.js v8** (board + 2D UI/FX) + **Three.js** (3D rescue scene) + **`@smoud/playable-sdk`** (MIT — MRAID/multi-network lifecycle + CTA) + **`vite-plugin-singlefile`** (single-HTML output). All MIT/open-source. |
| **Setting (LOCKED)** | **Real-world ancient-temple / jungle-ruins adventure** (sandstone, torches, vines, gold idols). Original **Indiana-Jones-archetype explorer** (fedora, whip, leather jacket, satchel) — chosen for recognizability + ad metrics. Full spec in `GAME_DESIGN.md`. |
| **Hazard** | **Rising lava in the temple shaft** (reads instantly; warm, high-contrast). Alts that fit the setting: collapsing ceiling / snake / rising water. |
| **Save interaction (LOCKED — corrected)** | **Match-3**: swap two adjacent blocks to align 3+; matched blocks are **permanently removed (no refill / no respawn)**. The **block field IS the obstacle** in the escape path — clearing it **directly frees the hero** (no abstract rescue meter). See `GAME_DESIGN.md` §3. |
| **Art pipeline** | **CC0 / free** asset packs, optimized hard; licenses tracked in `/assets/ATTRIBUTIONS.md`. |
| **Engine split** | Three = scene behind; Pixi = board/UI overlay in front; SDK = lifecycle glue. |

### SDK integration (confirmed API)
```js
import { sdk } from '@smoud/playable-sdk';
sdk.init((w, h) => new Game(w, h));        // boot once container is ready
sdk.start();                               // on first interaction → CHALLENGE_STARTED
sdk.on('resize', (w, h) => game.layout(w, h));
sdk.on('retry',  () => game.reset());      // satisfies RETRY requirement
sdk.on('volume', (v) => audio.setVolume(v));
sdk.finish();                              // on win OR fail → completion
sdk.install();                             // CTA → store redirect
// props: sdk.maxWidth/maxHeight, sdk.isReady, sdk.interactions, sdk.volume
```

---

## 1. Hard constraints (from the assignment)

- Runs via `npm install` + `npm run dev`; **portrait/mobile-first**, responsive, lightweight; works desktop + mobile browsers.
- Must include: **character in danger, clear threat, simple save interaction, success + failure outcomes, retry flow, strong visual feedback.**
- Readable in **first ~3 seconds**: what's the danger / what to do / what success looks like.
- **Single-file bundle must stay small** — ad networks commonly cap **2–5 MB**. Target **≤3 MB total**. This is the dominant constraint on asset choices.
- Deliverables structure: `/playable  /assets  /ai_logs  /walkthrough.mp4  /README.md`.

---

## 2. Architecture & file layout (target `/playable`)

```
/playable
  index.html              # mount + SDK boot
  vite.config.ts          # viteSingleFile(), base:'', high asset inline limit
  package.json
  src/
    main.ts               # sdk.init → Game; wire resize/retry/volume
    Game.ts               # state machine: idle → playing → win|fail; orchestrates scene+board
    scene3d/
      SceneManager.ts      # Three renderer, portrait camera framing, resize
      Explorer.ts          # character: idle/panic/climb/cheer states
      Temple.ts            # environment (pillars, ledge, exit arch)
      Lava.ts              # rising lava plane + emissive/scroll shader (the threat/timer)
      Idol.ts              # goal/reward prop
      Lights.ts
    board2d/
      Board.ts             # Pixi grid: tiles, tap-to-clear match, cascade + refill
      Tile.ts
      Fx.ts                # burst/particle feedback on clears
      Hud.ts               # progress bar + danger meter / timer ring
      Cursor.ts            # animated tutorial hand (first-seconds onboarding)
      Buttons.ts           # Try Again, Play Now! (→ sdk.install)
    game/
      Coupling.ts          # match clears → raise explorer / lower lava; progress %
      Director.ts          # pacing, lava auto-rise, onboarding timing, 25/50/75 marks
    audio/Audio.ts         # Howler sfx/music
    assets/                # glb, sprite atlas(png+json), audio, fonts (source)
```

**Layering:** one full-screen Three `<canvas>` (scene), a transparent Pixi canvas/overlay on top (board + UI). Both driven by `sdk.on('resize')` for a responsive portrait stage with letterboxing.

---

## 3. Work breakdown (phases)

| Phase | Goal | Key output |
|-------|------|-----------|
| **0 — Bootstrap** | Scaffold Vite + Pixi + Three + `@smoud/playable-sdk` + `vite-plugin-singlefile`; `npm run dev` shows a responsive portrait stage (Three behind, Pixi overlay). | Runnable empty playable |
| **1 — 3D scene** | Temple env + explorer on a ledge/pillar + **rising-lava plane** (emissive, scrolling shader) + portrait camera + lights/mood. | Readable "character in danger" frame |
| **2 — 2D board** | Pixi grid, 3 tile types + 1 special; tap-to-clear group match; gravity cascade + refill; satisfying **burst FX**. | Playable match board |
| **3 — Coupling & pacing** | Each clear **raises explorer one notch / lowers lava**; lava auto-rises as timer-by-proxy; progress meter; fire `sdk` interaction + 25/50/75 marks. | The core "matches = rescue" loop |
| **4 — Outcomes** | **WIN**: explorer escapes + grabs idol + "SAVED!" stamp + confetti + **Play Now!** (`sdk.install`). **FAIL**: lava overtakes + "OH NO!" stamp. Both call `sdk.finish()`. | Success + failure states |
| **5 — Retry** | `sdk.on('retry')` + in-ad **Try Again** button → reset scene/board/lava cleanly. | Retry flow |
| **6 — Onboarding/readability** | Animated **hand cursor** demo tap in first ~2s; hint arrow/text; danger + goal visible on load. | 3-second readability |
| **7 — Juice & audio** | Screenshake, GSAP easing, particle polish; sfx (pop / lava rumble / win fanfare / fail thud / click); end card. | "Polished ad creative" feel |
| **8 — Optimize & package** | Compress (Draco GLB, atlas, small audio) to hit ≤3 MB; single-file build; test desktop+mobile; produce deliverables. | Shippable bundle + docs |

---

## 4. ASSET PREPARATION CHECKLIST  ⟵ *(your direct ask)*

> Golden rule: **everything gets inlined into one HTML**, so every asset must be small. Favor low-poly + small textures + short audio + a single sprite atlas. Track every item in `/assets/ATTRIBUTIONS.md`.

### A. 3D scene assets (Three) — GLB, low-poly, Draco-compressed
| Asset | Spec | CC0 / free sources |
|-------|------|--------------------|
| **Explorer character** (rigged; idle / panic / climb / cheer anims) | GLB, <30k tris, ≤1×1024² atlas | **Quaternius** (Ultimate/Animated characters, CC0); **Kenney** "Animated Characters" (CC0); **Mixamo** (free rig+anims, retarget onto a CC0 mesh); **Poly Pizza** (filter CC0) |
| **Temple / ruins kit** (pillars, blocks, ledge, stairs, exit arch) | modular GLB, shared atlas | **Quaternius** Modular Ruins/Dungeon (CC0); **Kenney** Castle / Tower-Defense / Dungeon kits (CC0) |
| **Idol / treasure** (goal reward) | GLB, tiny | **Poly Pizza**, **Quaternius**, **Kenney** treasure props |
| **Lava** | *no model* — a plane + scrolling emissive shader we author | needs only a noise/lava texture (see B) |

### B. Textures / materials (CC0)
| Need | Spec | Source |
|------|------|--------|
| Stone, rock, gold, sand, lava/noise | 512–1024², webp or compressed png (or KTX2) | **Poly Haven** (CC0), **ambientCG** (CC0), **cc0textures** |

### C. 2D board + UI (Pixi) — pack into ONE sprite atlas
| Asset | Spec | Source |
|-------|------|--------|
| **Tile icons** (3 base + 1 special), explorer-themed: gem, gold coin, idol, map scroll, compass, key | 256² PNG transparent, consistent style | **Kenney** Board-Game / Puzzle / Game-Icons packs (CC0); **game-icons.net** (CC-BY → must attribute) |
| **Board frame / cells, panels** | 9-slice PNG | **Kenney** UI Pack / Game UI (CC0) |
| **Progress bar + danger/timer meter (radial ring)** | PNG | **Kenney** UI |
| **Buttons**: "Play Now!"/"Install", "Try Again", sound toggle | 9-slice PNG | **Kenney** UI |
| **Tutorial hand cursor** | PNG | **Kenney**, or author |
| **VFX sprites**: confetti, burst, sparkle, dust, smoke | PNG sheet | **Kenney** Particle Pack (CC0) |
| **Logo / wordmark** (our fictional game) | PNG/SVG | **design original** (display font + explorer motif) — *needs a game name from you* |

### D. Fonts (free, OFL via Google Fonts) — subset to used glyphs
- **Display** (logo / CTA / "SAVED!"/"OH NO!"): **Lilita One**, **Luckiest Guy**, **Titan One**, or **Fredoka** (heavy rounded).
- **Body/UI**: **Nunito** or **Poppins**.

### E. Audio (CC0 / free) — short, mono, ~64–96 kbps webm/mp3
| Need | Source |
|------|--------|
| Tap/match pop, cascade, button click, lava rumble loop, win fanfare, fail thud, (optional ambient) | **Kenney** Audio (UI / Impact / Casino, CC0); **Freesound** (filter CC0); **Mixkit** (free) |

### F. Copy / brand (you provide)
- Fictional **game name** + short tagline, **CTA label** ("Play Now!" / "Install"), placeholder **store URLs** (Google Play / App Store) for `sdk.install()`.

### Size budget (rough, ≤3 MB target)
| Bucket | Budget |
|--------|--------|
| 3D models (Draco GLB) | ~0.8–1.2 MB |
| Textures | ~0.4 MB |
| Sprite atlas (board+UI+FX) | ~0.4 MB |
| Audio (all) | ~0.3 MB |
| Fonts (subset) | ~0.1 MB |
| Code (Three+Pixi+SDK, minified+gzip) | the rest |

### License hygiene
- Prefer **CC0** (no attribution needed, but still log it). **CC-BY** (e.g. game-icons.net) → list author + link in `/assets/ATTRIBUTIONS.md`. **No ripped/copyrighted assets** (brief requirement). Mixamo characters: fine to use, but pair with a CC0/own mesh to be safe.

---

## 5. What to prepare *now* (prioritized shopping list)
1. **Explorer character** GLB with at least idle + one "panic" + one "cheer" animation → Quaternius or Kenney animated characters (fastest CC0), else Mixamo onto a CC0 mesh.
2. **Temple/ruins kit** (a few pillars + a ledge + an exit arch) → Quaternius/Kenney.
3. **Kenney UI Pack + Particle Pack + Board/Puzzle icon pack** (covers tiles, buttons, bars, FX in one consistent CC0 style).
4. **1 lava/noise texture** → Poly Haven/ambientCG.
5. **A handful of SFX** (pop, rumble, win, fail, click) → Kenney Audio.
6. **Pick a display font** from Google Fonts.
7. **Decide the game name** (for the logo + CTA).

> If you drop these into a folder, I'll optimize (Draco/atlas/subset/compress), wire them in, and keep the bundle under budget.

---

## 6. Open design decisions to confirm (non-blocking)
1. **Hazard:** rising lava (recommended) vs snake pit (most "Indiana Jones") vs crushing walls.
2. **Match interaction:** tap-to-clear groups (recommended) vs classic swap.
3. **Character fidelity:** full rigged 3D vs lighter 2.5D billboard (saves size/perf on mobile).
4. **Game name / brand** for logo + CTA.

---

## 7. Risks & mitigations
- **Size vs 3D:** GLB inlined as base64 bloats. → Draco + low-poly + few textures; fall back to **2.5D** (sprite explorer on a 3D temple) if needed.
- **Three + Pixi on mobile:** two render contexts can strain low-end devices. → Test on a real phone early (Phase 0); keep draw calls low; pause Three when off-screen.
- **Single-file inlining limits:** confirm `vite-plugin-singlefile` inlines GLB/audio (may need `assetsInlineLimit: Infinity` + base64). → Validate in Phase 0.
- **Readability:** if the match→rescue link isn't obvious in 3s, add the cursor demo + a one-line hint and make the first clear visibly move the explorer.

---

## 8. Deliverables mapping
| Brief wants | We produce |
|-------------|-----------|
| `/playable` | the Vite project |
| `/assets` | source CC0 assets + `ATTRIBUTIONS.md` |
| `/ai_logs` | `WORK_LOG.md` + prompts/workflow notes (this analysis lives here too) |
| `/walkthrough.mp4` | screen capture of a full play (ffmpeg already installed) |
| `/README.md` | technical decisions, what we simplified, priorities, future improvements |
