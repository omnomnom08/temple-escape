# "Save the Character" Playable Ads — Reference Analysis & Build Guide

> **Purpose.** Deep, frame-by-frame understanding of the four reference videos in `references/`, distilled into a build guide for the home assignment: *create an original, browser-based "Save the Character" playable ad* (Three.js/Pixi.js + Vite + Node LTS) with quality and readability comparable to modern **the modern rescue-ad benchmark**.
>
> **Important framing (from `pdf/Home Assignment Sett – Generalist Technical Artist.pdf`):**
> - Do **not** copy the references; do **not** use copyrighted assets. Design our own visuals.
> - Must include: a character in danger, a clear threat, a simple save interaction, **success AND failure** outcomes, a **retry flow**, strong visual feedback.
> - Player must grasp *what the danger is / what to do / what success looks like* within the **first few seconds**.
> - Portrait/mobile-first, responsive, lightweight, runs via `npm install` + `npm run dev`.
>
> So the references are studied as a **quality, readability, and mechanic target** — we extract the design DNA, not the brand. Per-video raw analyses live in `analysis/per-video/ref-1..4.md`; the running process log is `analysis/WORK_LOG.md`.

---

## 1. TL;DR — what the references are

All four are **creatives for a single title, from one publisher**: vertical 9:16, 30fps, ~60s each. Every one follows the same **"save the King" fake-gameplay funnel**:

> A cartoon **King** is trapped by an environmental **threat** (snake, spikes, electric arc, drowning, crushing). The bottom ~40–50% of the screen is a **match-3 board**. The player clears tiles; clearing **drains/erodes a physical obstacle** coupling the board to the rescue. A **timer/threat closes in**. In these *ads* the run is scripted to end in a deliberate **"FAIL"**, which hard-cuts to a branded end card — **"[TITLE]"** logo + a 2×3 grid of animated level vignettes + a green **"Play Now!"** button.

The FAIL is intentional loss-aversion bait ("I could do better → install"). **Our assignment differs in one key way: we must support a real win and a retry loop** (see §12–13).

| File | Resolution | FPS | Duration | Threat scenario | Save mechanic shown | Special intro |
|------|-----------|-----|----------|-----------------|---------------------|---------------|
| ref-1 | 1080×1920 | 30 | 59.9s | Green snake chase + spike pit (rubble wall) | Tap match-3 → erodes rubble, king climbs/escapes | — |
| ref-2 | 720×1280 | 30 | 60.0s | (a) Gold-ball pile → spikes; (b) Electric arc + toxic pipes | Swap match-3 → drains pile (two scenarios, two FAILs) | — |
| ref-3 | 720×1280 | 30 | 61.5s | Drowning in a glass tank + gravel flood | Tap match-3 → drains water; heart timer | Cinematic snake-chase intro; costume swap |
| ref-4 | 720×1280 | 30 | 59.1s | Button-flood maze pushing king into snake | Tap match-3 → pours buttons (adversarial); sewing/felt theme | "Choose your tool" 2-card pick + cut-the-rope tease |

---

## 2. The shared anatomy (universal funnel)

Every reference decomposes into the same beats. This is the **template to reproduce** (with our own art + a real win path):

```
[0–3s]   HOOK / READABILITY      Establish character-in-danger + threat + board. Hand cursor demonstrates the move.
[3–45s]  CORE LOOP               Player clears match board → obstacle drains/erodes → character advances OR threat closes in.
[~45–52s]CLIMAX                  Threat reaches the character (timer near zero / pile near full).
[1–2s]   OUTCOME                 FAIL screen (ads) — for us: WIN or FAIL.
[7–13s]  END CARD / CTA          Logo + animated level grid + "Play Now!" button (looping, with attractor tap).
```

Key structural facts:
- **Two coupled zones, always:** an upper **diegetic threat zone** (the rescue scene) and a lower **interactive board**. The coupling — *matches change the physical world above* — is the entire illusion and the core thing to nail.
- **The character is auto-driven**, never directly controlled. It climbs/sinks/gets-pushed as a *side effect* of board progress (or a scripted timer). The player only ever touches the board (and, in ref-4, one card-choice tap).
- **The threat is a timer-by-proxy.** Snake descent (ref-1/4), draining ball pile (ref-2), heart ring (ref-3), rising buttons (ref-4) all visually communicate "time is running out" without numerals.
- **UI is deliberately stripped** during gameplay (no score, no move counter, no level number). The *only* persistent diegetic labels seen are **"EXIT"** (ref-1, ref-4) and the threat/timer meter.

---

## 3. Core mechanic deep-dive — the board ↔ obstacle coupling

**Board.** A match-3 grid occupying the lower 40–55% of the screen. Verified directly from frames:
- **Exactly 3 tile types per ad**, and **one is always a gold crown** (the brand token). The other two vary:
  - ref-1: red gummy block + green spade/leaf + **gold crown** (cream cells `#F2EAD6`).
  - ref-2/ref-3: red block + blue shield + **gold crown**.
  - ref-4: red block + green leaf + **gold crown**.
- Tile colors are high-saturation candy: red `~#E0202A`, blue `~#2C7BE0`, green `~#3FB52E`, gold `~#F2C014`.
- **Cursor:** a single oversized 3D **pointing hand** with a red-and-gold royal cuff (blue gem). It is a *tutorial/attractor* cursor.

**Interaction — tap vs. swap.** The references are mixed, and it matters for our build:
- ref-1, ref-3, ref-4 visually read as **tap-to-clear a group** (finger lands on one tile; a cluster bursts).
- ref-2 reads as **swap-adjacent** (classic match-3).
- The real game is swap-based. **For a playable, tap-to-clear is simpler to implement and to teach in 3 seconds** — recommended for our build (see §13). Either way: a successful clear = **particle burst + cascade refill** of tiles falling from above.

**The coupling (the magic).** Each clear sends a "pulse" that mutates the upper threat zone. Observed couplings:
- **Erode** an obstacle wall so the character moves through a channel (ref-1 rubble).
- **Drain** a pile/liquid that is restraining or threatening the character (ref-2 balls, ref-3 water).
- **Pour/raise** material that pushes the character (ref-4 buttons — *adversarial*, the fail-bait twist).

> **Design takeaway:** the board is a *meter you operate by playing*. Clearing N tiles ≈ removing one "layer" of the obstacle. The character's position is a pure function of obstacle state.

> **⚠ Mechanic correction (our build, after re-watching):** it is genuinely **match-3** (align **3+**), and for our playable the **matched blocks are permanently removed with NO refill/respawn** — and the **block field IS the obstacle** in the escape path, so clearing it **directly frees the character** (no separate abstract "rescue meter"). This corrects an earlier reading of "tap-to-clear groups + infinite refill." Authoritative spec: `GAME_DESIGN.md` §3.

---

## 4. Threat / hazard catalogue

Across the four ads and the end-card vignettes, the franchise advertises a **modular hazard set**. Each is "character + restraint + lethal element":

| Hazard | Restraint that drains | Lethal element | Seen in |
|--------|----------------------|----------------|---------|
| Rubble wall + spikes | colored stone rubble | spike pit + chasing snake | ref-1 |
| Ball crush | pile of gold balls | fan of golden spikes | ref-2 (scene 1) |
| Electrocution | red/brown rubble pile | high-voltage arc + toxic pipes | ref-2 (scene 2) |
| Drowning | water level + gravel | suffocation/flood in glass tank | ref-3 |
| Button flood | rising sewing buttons | snake mouth at top of maze | ref-4 |
| Lava / sawmill / waterfall-ice | varies | lava, saw blade, freezing water | end-card vignettes (all) |

The end cards consistently show **6 vignettes** (2×3) so the viewer infers variety. The recurring **green serpent** is the franchise's signature antagonist.

---

## 5. Pacing & timing (the funnel timeline)

Measured from the frames (2fps extraction; `f_NNN`≈`(NNN-1)×0.5s`):

| Beat | ref-1 | ref-2 | ref-3 | ref-4 |
|------|-------|-------|-------|-------|
| Hook / first move | ~1.5s | ~0s | ~4.5s (after intro) | ~2s (card choice) |
| Core loop length | ~44s | ~21s ×2 scenes | ~47s | ~41s |
| FAIL appears | ~46s | ~22s & ~52s | ~52.5s | ~50s |
| End card dwell | ~12s | ~6s ×2 | ~7s | ~7s |

Patterns: a fast hook (≤3s to first interaction or clear demonstration), a long tension build, FAIL near the 50s mark, then a looping end card with an attractor hand tapping "Play Now!". ref-2 proves the funnel can **repeat twice** in one 60s spot.

---

## 6. Visual language

**Art style.** Polished, glossy, "candy" 3D casual render — soft global illumination, rounded chunky shapes, subtle depth-of-field, juicy physics (bouncing balls, tumbling rubble/buttons, cascading tiles), exaggerated character panic poses, punchy burst FX. This is the **quality bar** to match (achievable in Pixi with good sprites/lighting or lightweight Three.js).

**Camera.** Top-down / slightly-angled overhead (3/4) on both the scene and the flat board. ref-1/ref-3 use a camera pan/zoom on key transitions (king reaches the door; intro chute). End cards are flat 2D composites.

**Character (the "King").** Stout, white/orange beard, gold crown with red gem, purple-and-gold robe (ref-3 swaps to a blue diver suit underwater). Highly expressive: arms flailing, head-clutching, celebration poses. *For us: design an original mascot with the same silhouette logic — round, readable, one signature color, big expressive reactions.*

**Color palette (reference anchors):**
- Tiles: red `#E0202A`, blue `#2C7BE0`, green `#3FB52E`, gold `#F2C014`; cream cells `#F2EAD6`.
- King: royal purple `#5E2E9E` + gold `#E6B422`.
- Threat greens (snake/toxic): lime `#7FD13A`, toxic `#3FD23F`.
- CTA green button: `~#6FB52A`–`#7CC243`.
- FAIL red: `#E02828` with gold rim.
- Environment neutrals: slate/teal/navy backgrounds, grey stone, amber/orange structural frames.

**Typography.** The title logo — heavy 3D rounded letters, a gold word above a white word on a blue plaque with gold trim. "Play Now!" and "FAIL" use the same heavy rounded sans, white fill, dark/colored outline. *For us: pick one heavy rounded display face for logo/CTA/outcome text.*

---

## 7. The FAIL screen (verified, ref-1 f_094 / ref-3 f_106)

- **Background:** the gameplay frozen and **blurred/defocused**.
- **Center:** a large **glossy red circular push-button**, **gold outer rim + white inner ring**, with bold white **"FAIL"** text. Springy pop-in animation.
- Appears for ~1–1.5s, then hard-cut to the end card.

*For our build we mirror this treatment for both outcomes:* a **WIN** stamp (green/gold, e.g. "SAVED!") and a **FAIL/"OH NO!"** stamp (red), each on a blurred, frozen scene — see §13.

---

## 8. The end card / CTA (verified, ref-1 f_105)

- **Top:** "[TITLE]" 3D logo, centered.
- **Middle:** a **2×3 grid of 6 rounded thumbnails** with glowing **yellow borders**, each a *looping animated* mini-rescue (rocks+arrows, sand pour, snake+water+lava, lava chimney, sawmill, waterfall→ice). They animate continuously, not static.
- **Bottom:** a large **green "Play Now!" pill** button, white outlined text, blue glow, gentle pulse/scale. An **attractor hand cursor** taps it (~f_101+).
- **No App Store / Google Play badges** appear in any of the four (the in-creative "Play Now!" is the only CTA).

*For us: a single looping end card with our logo + our scene thumbnail(s) + a pulsing "Play Now!" / "Install" CTA and a replay/attractor.*

---

## 9. Readability principles (the "first 3 seconds" rule)

Why these ads communicate instantly — patterns to copy:
1. **Spatial separation of roles:** danger is **top**, your tool (board) is **bottom**. No ambiguity about where to look or touch.
2. **One verb:** the hand shows exactly one gesture (tap/swap) immediately; no menus, no text instructions.
3. **Threat is always visible and always moving toward the character** — the stakes render themselves.
4. **Cause→effect is immediate:** the first clear visibly moves the obstacle, teaching the rule without words.
5. **Color-coded outcomes:** green = good/win/CTA, red = danger/fail.
6. **Stripped HUD:** nothing competes with the danger + board.

---

## 10. KEEP vs. CHANGE for our original playable

| Aspect | Keep (it's why the format works) | Change (assignment / originality / legal) |
|--------|----------------------------------|--------------------------------------------|
| Two-zone layout (threat top, board bottom) | ✅ Keep | — |
| Match-style tap interaction | ✅ Keep (use tap-to-clear) | — |
| Board ↔ obstacle coupling | ✅ Keep | Make it **constructive** (matching *saves*), not adversarial |
| Visible closing threat as timer | ✅ Keep | — |
| FAIL outcome + blurred-scene stamp | ✅ Keep treatment | **Add a real WIN outcome** (required) |
| Retry | — | **Add explicit retry flow** (required; ads have none) |
| Looping end card + CTA | ✅ Keep | Our own logo/brand, no store badges needed |
| The King mascot, snake, "[TITLE]" logo, exact art | ❌ | **Replace with 100% original assets** (no copyrighted assets) |
| Deliberate-loss scripting | ❌ | Player input must genuinely determine win/lose |

---

## 11. Recommended design for our playable (concept brief)

A concrete, original concept that satisfies every requirement while echoing the references' readability:

- **Character:** an original round, expressive mascot (e.g. a little **astronaut / cat / robot** — one signature color, big eyes, panic + cheer animations).
- **Scene (top zone):** character trapped on a shrinking ledge as a **lethal element rises/closes** — pick one clean hazard for readability, e.g. **rising lava** (or water). The character stands above it; the gap is the timer.
- **Board (bottom zone):** a tap-to-clear grid of **3 candy tiles + 1 special** on cream cells. Each cleared group **drains the lava one notch / builds one rung of an escape path**.
- **Goal (constructive coupling):** clear enough groups before the lava reaches the character → character climbs out → **WIN**. If the lava reaches them first → **FAIL**.
- **Timer-by-proxy:** the lava level itself (no numerals); optionally a thin radial ring echoing ref-2/ref-3.
- **Feedback:** burst particles + screenshake on clears, juicy tile cascade, character reactions, a green "SAVED!" stamp or red "OH NO!" stamp on a blurred scene.
- **Retry:** outcome card → **"Try Again"** button (re-init state) + the end-card **"Play Now! / Install"** CTA.
- **First-3-seconds:** open with the hazard already rising and a hand cursor tapping the first group — danger, action, and success path all legible immediately.

**Tech:** Pixi.js (2D, lightest path to this candy look + crisp text) on Vite; portrait-first responsive canvas with letterboxing; one sprite atlas; runs via `npm install && npm run dev`. (Three.js viable for 2.5D, but 2D maximizes readability/polish-per-effort per the brief.)

---

## 12. Requirements traceability

| Assignment requirement | How references satisfy it | Our plan |
|------------------------|---------------------------|----------|
| Character in danger | King trapped by snake/spikes/water/etc. | Original mascot on a ledge above rising lava |
| Clear obstacle/threat | Always-visible closing threat (top zone) | Rising lava level = obvious threat + timer |
| Simple interaction | One gesture: tap/swap board | Tap-to-clear groups of 3+ |
| Success outcome | (absent in ads — only FAIL) | "SAVED!" win stamp + escape animation |
| Failure outcome | Red "FAIL" stamp on blurred scene | "OH NO!" fail stamp, same treatment |
| Retry flow | (absent in ads) | "Try Again" resets the round |
| Strong visual feedback | Particle bursts, physics, panic poses, juicy FX | Burst FX, screenshake, cascades, reactions |
| Readable in 3s | Top danger / bottom tool / one verb / moving threat | Same layout + cursor demo on load |
| Portrait/mobile, lightweight | 9:16, minimal HUD | Pixi + Vite, responsive 9:16 canvas |

---

## 13. Asset & frame index (for re-checking)

- **Videos:** `references/ref-1.mp4 … ref-4.mp4`.
- **Extracted frames (2fps, 540px wide JPGs):** `analysis/frames/ref-N/f_001.jpg …`. Mapping: `f_NNN` ≈ `(NNN-1)×0.5` seconds.
- **Key frames verified by hand:**
  - Board + coupling: `frames/ref-1/f_020.jpg` (hand on tile, rubble channel), `frames/ref-2/f_001.jpg` & `f_030.jpg` (ball pile + spikes + muscle timer).
  - FAIL screen: `frames/ref-1/f_094.jpg`, `frames/ref-3/f_106.jpg`.
  - End card: `frames/ref-1/f_105.jpg` (logo + 6 vignettes + Play Now!).
- **Per-video deep reports:** `analysis/per-video/ref-1.md … ref-4.md`.
- **Process log:** `analysis/WORK_LOG.md`.

> To re-extract at higher density for any beat (e.g. the FAIL transition), use:
> `ffmpeg -ss <start> -to <end> -i references/ref-N.mp4 -vf fps=10 out/%03d.jpg`
> (ffmpeg 8.1.1 installed at `…\WinGet\Packages\Gyan.FFmpeg_…\bin`).
