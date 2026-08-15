# Reference ad — frame analysis (ref-2)

> Source: 720×1280, 30fps, 60.0s. Frames at 2fps (`f_001`=0.0s … `f_120`≈59.5s). Full report from per-video analysis agent.

## 1. Overview
Ad for **the reference title** — casual match-3 (tile-swap) with "save the King from a trap" framing. Fake-gameplay rescue puzzle: swap/clear tiles to drain a physical hazard holding the King while racing a timer. Arc is **lose → CTA → lose → CTA**: two distinct trap scenarios, both end in **FAIL**, each cutting to the "[TITLE] / Play Now!" end card.

## 2. Timeline
| Frames | Time | Scene |
|---|---|---|
| f_001–018 | 0–8.5s | **Scene 1 — Spike Trap.** Trap chamber; King pressed against a wall of gold/pearl balls (left); curved row of golden spikes (right). Finger swaps tiles on board below. |
| f_019–044 | 9–21.5s | Scene 1 re-framed/zoomed. King pushed rightward toward spikes as ball-pile drains. Circular **muscle/strength timer** drains green→orange→red. |
| f_045–048 | 22–23.5s | **FAIL #1.** Red "FAIL" button over blurred chamber. |
| f_048–060 | 23.5–29.5s | **End card #1.** "[TITLE]" logo + 6 mini-puzzle panels + green "Play Now!". Finger taps button f_053–055. |
| f_061–104 | 30–51.5s | **Scene 2 — Electric/Toxic Trap.** Industrial chamber: two glowing green toxic pipes, high-voltage electric arc across top, King on red/brown rubble pile rising toward the arc. Board fills lower screen; finger swaps tiles. |
| f_105 | 52s | **FAIL #2.** Red "FAIL" button. |
| f_106–120 | 52.5–59.5s | **End card #2.** Same layout, looping panels. |

## 3. Core Mechanic
**Match-3 tile swapping.** Grid of red blocks, yellow crowns, blue shields. A disembodied cartoon hand (red/white striped sleeve, gold cuff) swaps adjacent tiles to form 3+ matches; tiles pop/clear (particle bursts), cascade refills. Each match reduces the hazard:
- Scene 1: drains the gold-ball pile — but this **shoves the King toward the spikes** (deliberate "watch the noob fail" framing).
- Scene 2: eats the rubble pile under the King, changing his height vs. the arc.
Circular countdown timer adds urgency. Pure swap-match — no merge/build/shoot.

## 4. UI
- **Circular timer / strength meter** (Scene 1, top-center): flexed-bicep icon in a ring; radial countdown draining green→orange→red (icon also recolors).
- **Board:** red blocks, yellow/gold crowns, blue shields on cream cells.
- **Pointer hand** (scripted tutorial cursor).
- **FAIL button:** red center, white ring, gold rim, white "FAIL".
- **End card:** the title logo (gold word + white word on a blue plaque); "Play Now!" green capsule; 6-panel 2×3 grid.
- No score/currency/progress/lives in gameplay.

## 5. Visual Style
Glossy 3D casual render. Scene 1: teal/slate bg ~#3E6B72, gold balls ~#C8B47A, gold spikes ~#F2C233. Scene 2: dark steel/navy ~#1E2A38, toxic green pipes ~#3FD23F, radiation-yellow barrels ~#F2C200, cyan electric arc ~#9FE8FF, red-brown rubble ~#7A3B2E. Tiles: red ~#E23B36, gold ~#F4C430, blue ~#3A77E0. CTA green ~#7CC243. King: round face, orange beard, gold crown, purple robe + gold trim, blue boots; animated panic (arms flailing, head-clutch). Tilted top-down 3/4 trap-room view; static camera per scene with a re-crop ~f_019. Juicy physics, cascades, particle bursts, springy FAIL pop-in.

## 6. Win / Fail / Reward
No win/reward. Fail #1 f_045–048 (~22–23.5s): King reaches spikes. Fail #2 f_105 (~52s): King about to be electrocuted (head-clutch panic). Before/after framing in both scenes.

## 7. End Card / CTA
Two identical end cards (f_048–060, f_106–120): "[TITLE]" logo; 6 animated 2×3 puzzle vignettes (stones/gate, logs, water+snake, lava, saw-blade, spikes+water); green "Play Now!" capsule (finger taps). No store badges / price; dark blurred dungeon bg.

## 8. Notable for rebuild
- Deliberate "losing" demo — both runs FAIL. Real playable should let user actually win before the end card.
- Two reusable trap templates on one match-3 core: (1) ball-pile pushes King into gold spikes w/ muscle-icon countdown; (2) rubble pile under high-voltage arc + toxic pipes/barrels.
- Exactly 3 tile types: red block, gold crown, blue shield.
- Scripted finger drives every move; matches = particle pops + cascade refill.
- Crop/zoom change ~f_019.
- FAIL button = springy 3D red/white/gold pushbutton over blurred board.
- End card is animated (panels loop), not static — 6 looping mini-scenes.
- Preserve urgency timer + visible cause→effect of matches on hazard.
