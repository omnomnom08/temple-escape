# Shipped reference creative — extracted configuration

> **Source:** `the saved creative HTML` (saved AppLovin creative, Unity → Luna Playground build).
> **What's in it:** the wrapper only. `<script id="LUNA_PLAYGROUND_BUNDLES">` is **empty** and there are no inlined assets, so the game cannot be run and no code/art is recoverable. What *is* intact is `window.playgroundOverrides` — the live tuning config the publisher shipped with.
> **What we take:** parameter values and technique. No assets, no code, no branding. Consistent with the brief's "original build, no copyrighted assets".
> Extracted 2026-08-11.

---

## 1. The rock debris system — this is exactly our L1

Two config blocks describe it. Note the class name: **`CustomPhysicsController`** — they wrote their own solver, not a physics engine. Our decision to drop `cannon-es` matches what actually shipped.

### `<Publisher>.Playable.Road.RockSpriteController`
```
UseRockPalette   : true      rockPaletteIndex : 0
rock1Color       : 0.780, 0.573, 0.349      rock1BaseGrey : 0.55
rock2Color       : 0.616, 0.549, 0.475      rock2BaseGrey : 0.50
rock3Color       : 0.816, 0.816, 0.816      rock3BaseGrey : 0.65
rock4Color       : 0.365, 0.322, 0.267      rock4BaseGrey : 0.48
rockTypeWeights  : [28, 28, 15, 29]         (sum = 100)
```

**Read:** **4** rock variants, not 5, spawned on a weighted roll — type 3 (the near-white one) is deliberately rare at 15%.

The `BaseGrey` + `Color` pairing is the important trick. *Inference, but a strong one:* the sprites are authored **greyscale**, normalized by their own average grey (`BaseGrey`), then multiplied by the palette color — roughly `out = (texGrey / baseGrey) * rockNColor`. That means **one greyscale rock sheet re-tints into any palette at zero asset cost** (`rockPaletteIndex` implies several palettes ship). For us: author the rocks grey once, tint to sandstone in-engine, and re-tint for free if the temple palette changes.

### `CustomPhysicsController`
```
enableSpin              : true
spinFPS                 : 24        // spin animation frame rate
spinMovementThreshold   : 0.04      // below this speed, stop spinning
angleFPS                : 12        // rotation updates 12×/sec
angleDelta              : 10        // rotation quantized to 10° steps
enableFlowAudio         : true
flowAudioVolume         : 0.5
flowDownwardSpeedThreshold : 3      // "flowing" = falling faster than 3 u/s
flowMinRockCount        : 10        // ...and at least 10 rocks doing it
flowSoundCooldown       : 0.7
flowStartupIgnoreSeconds: 0.6
```

**This corrects your memory of the technique, and the real answer is cheaper than what you described.** It isn't "swap the image based on speed." It's three separate tricks:

1. **A spin sprite animation at 24 fps** — the rock frames *are* an animation loop, which is why it reads as tumbling stone.
2. **Rotation quantized to 10° steps, updated at only 12 fps.** Not continuous rotation. Deliberately chunky, and it halves the transform updates.
3. **A movement threshold (0.04) that freezes settled rocks.** Once a rock stops, its animation stops — settled rubble costs nothing. This is the actual perf win, and it's one `if`.

**The flow-audio recipe is the "satisfying" secret and it's trivially portable:** play the rumble only when **≥10 rocks are falling faster than 3 u/s**, cooldown 0.7 s, ignore the first 0.6 s after spawn. That's why the references *sound* like a landslide instead of a bag of clicks. Straight into W4.

---

## 2. Global simulation + perf
```
FixedTimestep : 0.02      // 50 Hz fixed step
Gravity       : (0, -10, 0)
ssao          : isActive = 0     // post-processing explicitly OFF
```
Fixed 50 Hz step for the rock sim, gravity −10. SSAO shipped **disabled** — worth noting given our shadow-map cost.

---

## 3. Level data — the balance answer we needed

Levels ship as **Tiled JSON** (`tiledversion 1.11.2`), one per phase, 100×100 px tiles:

| Phase | Grid | Distinct tile IDs | Moves |
|---|---|---|---|
| 1 | **7 × 10** | `{1, 3, 4}` → **3 colors** | 32 |
| 2 | 8 × 12 | `{1, 3, 4}` → **3 colors** | 32 |
| 3 | 11 × 15 | `{1, 2, 3, 4}` → 4 colors | 32 |

`PhaseDuration: 60` seconds per phase.

**This is the most actionable thing in the file.** The shipped opening board uses **three colors**. We use **five** (`COLORS` in `board3d.js`). Five colors on a 48-cell board with no refill is a large part of why our late game starves and `_reshuffle()` thrashes — the odds of any three adjacent survivors matching collapse as the grid fragments. Dropping to 3 colors raises match density enormously and is a one-line change.

Also note phase 3's grid is a hand-authored **concentric diamond** pattern, not random fill — the boards are designed, not generated. Ours is randomly filled with an anti-match guard.

---

## 4. Tutorial — a precise recipe
```
IsTutorialEnabled : 1     IsMaskEnabled : 1     IsHandEnabled : 1     IsHighlightEnabled : 1
maskPositions : [6,9] [5,9] [4,9] [4,8] [5,8] [6,8]     // a 3×2 block
handPosition  : [5,9]
```
The board is **masked/dimmed except six cells** — a 3×2 block at the bottom-right of the 7×10 grid — with the hand parked on one cell and a highlight on top. The player is given exactly one legible option. Ours currently animates a hint swap on an undimmed board, which is far weaker for 3-second readability.

---

## 5. Ad funnel + lifecycle (confirms our SDK wiring)
```
GoToMarketAfterXMovePhase2       : 1     // store redirect after ONE move in phase 2
RedirectAfterMarketReturnWhenXClick : 1
GoToMarketAtEndCardStageAfterXSeconds : 3
IsInGameCTAEnabled : 0                    // NO CTA button during gameplay
IsInGameLogoEnabled: 1                    // logo top-left instead
```
`VignetteController.phaseStartDelay: 50` — after **50 seconds the ad plays itself** (autopilot, red autoplay tint). `BannerController.messageText: "I can't save the King!"` — the nagging banner, top-center, 62 % black backing.

AppLovin event set in the wrapper — `CHALLENGE_STARTED / FAILED / RETRY / PASS_25 / PASS_50 / PASS_75 / SOLVED`, plus `CTA_CLICKED`, `ENDCARD_SHOWN`. This is exactly what `@smoud/playable-sdk` exposes, and confirms `BUILD_PLAN.md`'s 25/50/75 progress marks are real network expectations, not decoration.

Packaging: `resourceConfig` inlines json/image/video and **compresses sound and blobs** — same single-file strategy as ours.

---

## 6. What we adopt

| # | Change | Where | Cost |
|---|---|---|---|
| **A1** | **3 gem colors, not 5** | `board3d.js` `COLORS` | one line — do it first, biggest balance win |
| **A2** | 4 rock variants, weighted `[28,28,15,29]`, one **greyscale** sheet tinted per-type | W1 + your art | saves you authoring colored variants |
| **A3** | Spin animation ~24 fps; **rotation quantized to 10° at 12 fps**; freeze below speed 0.04 | W1 | cheaper than continuous rotation |
| **A4** | Flow audio: ≥10 rocks falling >3 u/s → rumble, 0.7 s cooldown, 0.6 s startup ignore | W4 | this is the "satisfying" sound |
| **A5** | Fixed 50 Hz step, gravity −10 | W1 | matches their feel directly |
| **A6** | Tutorial **masks all but the 6 cells** of the intended match + hand + highlight | W2/W5 | much stronger 3-second read |
| **A7** | No in-game CTA; logo only. CTA at the end card | W5 | matches shipped funnel |
| **A8** | Hand-author the starting board instead of random fill | W2 | guarantees a good opening + tutorial match |
| **A9** | Consider autopilot after ~50 s of no progress | later | nice-to-have, not for 4 days |

Not adopted: 3 phases / 32-move budget / forced store redirect mid-phase — that's their fake-gameplay funnel; the brief wants a real win **and** fail state.
