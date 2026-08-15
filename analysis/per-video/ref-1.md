# Reference ad — frame analysis (ref-1)

> Source: 1080×1920, 30fps, 59.86s. Frames at 2fps (`f_001`=0.0s … `f_120`≈59.5s). Full report from per-video analysis agent.

## 1. Overview
Ad for **the reference title** — casual **match-3** with a "king in peril" rescue framing. Bottom = match-3 board; matching erodes a wall of colored rubble above so a purple-robed king can climb/escape toward a door while a **green snake** pursues. Loss-aversion (failure-bait) ad: king nearly escapes, snake catches him, run ends on a deliberate **FAIL**, then cuts to a 6-thumbnail end card with **"Play Now!"**.

Gameplay: f_001–f_092 (~0–45.5s). FAIL: f_093–f_095 (~46–47s). End card: f_096–f_120 (~47.5–59.5s).

## 2. Timeline
| Frames | Time | Scene |
|---|---|---|
| f_001–003 | 0–1.0s | Establishing: snake head peeks top-left, chamber of blue/purple/pink rubble, purple king in left alcove, match-3 board below (red gummy, green spade, gold crown). |
| f_004–032 | 1.5–15.5s | Core loop: large hand taps tiles; each match erodes the rubble wall; king begins climbing the cleared channel. |
| f_033–039 | 16–19s | Central channel mostly clear; king reaches top, celebration pose. |
| f_040–049 | 19.5–24s | King advances along upper corridor to an **orange door** (~24s). |
| f_050–052 | 24.5–25.5s | Camera pans/zooms; new vertical **translucent tube/slide with orange hoops** appears right; king enters door. |
| f_053–055 | 26–27s | King slides down looping tube; **"EXIT"** sign + green left-arrow and a **spike pit** revealed at bottom. |
| f_056–092 | 27.5–45.5s | Tension + fresh board (left). Snake **descends the tube** getting larger each frame; player keeps matching to clear remaining rubble; debris falls toward spikes. |
| f_092 | ~45.5s | Catch: yellow/orange flash where snake head meets king. |
| f_093–095 | 46–47s | **FAIL** screen: red circular button, gold/white rim, white "FAIL". |
| f_096 | ~47.5s | Transition: 6 panels fly into a grid, green CTA pill appears. |
| f_097–120 | 48–59.5s | End card: "[TITLE]" logo, 3×2 grid of 6 animated level thumbnails, pulsing green **"Play Now!"**; hand taps button at f_101–102. |

## 3. Core Mechanic
- **Tap-to-match** with an oversized hand/finger cursor (red-and-gold royal cuff, blue gem). Matches burst with particles; gaps open in the board.
- Matching drives an **obstacle-clear meta**: each match damages the rubble wall, opening a channel the king auto-climbs. The king is AI/auto-moving, not directly controlled.
- Hazards: spike pit + pursuing snake create a race-against-time. Tile types: red rounded square (gummy), green leaf/spade, gold crown.

## 4. UI
Intentionally minimal during gameplay: hand cursor; **"EXIT"** green label + left arrow; no score/moves/timer/currency visible. FAIL screen = red button "FAIL". End card = the title logo (heavy 3D gold word over a second word on a blue banner), 6 yellow-bordered thumbnails, green "Play Now!" pill (pulsing). No store badges visible.

## 5. Visual Style
Bright glossy candy-like 3D casual render; top-down/slightly-angled overhead view. Palette: tile red ~#E02828, green ~#3FB52E, gold ~#F2B61E; board cell cream ~#F2EAD6; rubble slate-blue ~#5C7A9E / purple ~#8A6FB0 / pink ~#E0A8C8; walls grey ~#8A8E8F with amber frames ~#E8932A; snake lime ~#7FD13A; king robe royal purple ~#5E2E9E + gold; tube translucent grey-blue with orange hoops; spikes silver. King = stout, white beard, gold crown, purple cloak. Snake = bright-green serpent. Smooth bouncy physics, particle bursts, punchy FAIL flash.

## 6. Win / Fail / Reward
No win state — deliberate-fail ad. Sustained "almost there" tension (f_029–092), catch flash at f_092, explicit FAIL at f_093–095. No coins/stars. End-card thumbnails act as mini before/after demos of different hazards.

## 7. End Card / CTA
"[TITLE]" logo top; 3×2 grid of 6 animated vignettes: (1) stone rubble + descending arrow blockers; (2) grain/sand chamber; (3) snake + water + lava; (4) lava chimney; (5) sawmill/logs; (6) snake + waterfall + ice spikes. Green pulsing "Play Now!"; finger taps at f_101–102. No store badges.

## 8. Notable for rebuild
1. Two-stage layout: playable board (lower) + physics obstacle zone (upper) that matches drain/erode.
2. Tap-to-match (not drag-swap).
3. Auto-moving king gates progress.
4. Threat (snake) descends a fixed path at steady rate = timer-by-proxy; flash-catch = fail trigger.
5. Modular hazard set (rubble, spikes, lava, sand, water/waterfall, logs/saw, ice).
6. Board partially obscured by rubble that spills into gaps.
7. Camera transition when king reaches the door.
8. FAIL at ~45.5–46s; ~13s end-card dwell.
