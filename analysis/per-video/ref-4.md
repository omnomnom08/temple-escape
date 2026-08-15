# Reference ad — frame analysis (ref-4)

> Source: 720×1280, 30fps, 59.11s. Frames at 2fps (`f_001`=0.0s … `f_118`≈58.5s). Full report from per-video analysis agent.

## 1. Overview
Ad for **the reference title** ("save the King" match-3) with a distinctive **sewing/craft** theme. Arc:
1. **Hook / fail-bait intro (0–2.5s):** pin-pull / cut-the-rope mini puzzle tease; King must escape a green serpent.
2. **Cut-the-rope choice (2.5–4.5s):** two-card choice (needle+thread vs. ladder) with a pointing hand.
3. **Rope/thread sequence (4.5–8s):** King climbs a red thread; scissors threaten to cut it.
4. **Main fake gameplay (8–50s):** top maze where buttons pile up and push the King toward the snake's mouth + bottom match-3 board. Taps clear tiles; clearing dumps buttons into the maze.
5. **FAIL (50–51.5s):** big red "FAIL" button.
6. **End card / CTA (51.5–58.5s):** "[TITLE]" + 6 vignette thumbnails + green "Play Now!".

## 2. Timeline
| Frames | Time | Scene |
|---|---|---|
| f_001 | 0s | Intro: King (left) opening a gold chest; green button-eyed serpent (right) on tan felt. |
| f_002–003 | 0.5–1s | Camera rotates to top-down maze; King near a glowing crown treasure in an L-shaped felt corridor. |
| f_004 | 1.5s | Sparkle burst; a blue shield-shaped card flies up. |
| f_005–008 | 2–3.5s | **Two-card choice:** blue castle-banner cards — left needle+red thread, right ladder. Hand taps the needle/thread card. |
| f_009 | 4s | Choice confirmed; ladder card fades; maze view returns. |
| f_010–011 | 4.5–5s | Maze: needle with trailing red thread; King on a ledge; crown treasure top-right. |
| f_012–014 | 5.5–6.5s | King climbs the red thread; **scissors** appear threatening to cut it. |
| f_015–017 | 7–8s | King swings near the serpent's mouth; bins of colored **buttons** at edges. |
| f_018–019 | 8.5–9s | **"EXIT"** label + yellow arrow at a wooden arched door; match-3 grid (red, gold crown, green) appears at bottom with hand. |
| f_020–049 | 9.5–24s | **Main loop:** top — King braces a **yellow plank/dam** holding back a flood of orange/blue/grey buttons in a snaking maze, green serpent looming. Bottom — tap match-3 tiles; each clear pours more buttons into the maze. |
| f_050–080 | 24.5–39.5s | Buttons flood the right side of the board (board shrinks) and rise in the maze, pushing King toward the descending serpent. |
| f_081–100 | 40–49.5s | Snake's mouth beside the King; he pushes the plank; buttons nearly fill everything; board mostly covered. |
| f_101–103 | 50–51s | **FAIL** — red circular button, white "FAIL", blurred board. |
| f_104 | 51.5s | Transition: screenshots scatter into a grid. |
| f_105–118 | 52–58.5s | **End card:** "[TITLE]" logo, 6 animated vignette thumbnails, green "Play Now!" (hand taps f_109–110). |

## 3. Core Mechanic
Two layered interactions driven by one pointing hand (red/gold royal wristband):
- **Card choice (f_005–009):** tap one of two banner cards to pick a tool (needle-thread vs ladder) — one-time "which item saves him?" decision.
- **Match-3 tapping (f_018–100):** tap/clear tile groups of 3 icon types — red blocks, gold crowns, green leaf/spade — on a tan grid (tap-to-clear/collapse, not strict swap).
- **Consequence linkage:** clearing tiles releases a torrent of **sewing buttons** (orange/blue/grey/silver) into the upper felt maze; buttons act as a rising physics fill pushing the King toward the serpent. A **yellow plank** is the dam he holds back. Deliberately ends in FAIL (buttons push him to the snake).

## 4. UI
Minimal HUD. Two choice cards (blue castle/banner shields; needle+thread, ladder). **"EXIT"** yellow label + yellow right-arrow at a door. Pointing hand (red/gold wristband). Board with no score/moves/progress/currency. **"FAIL"** white text on red glossy circular button (white/gold rim). End-card text: "[TITLE]", "Play Now!". No coin/gem/lives/level/timer anywhere.

## 5. Visual Style
Polished 3D cartoon (the reference look). **Signature sewing/craft aesthetic:** stitched felt/fabric + yarn — tan/beige felt fields, dark-brown corridors, maroon-red yarn walls with yellow dashed stitching; collectibles are literal **sewing buttons**. Palette: felt #D9B98C–#C9A878; corridor shadow #3A2A1E; walls maroon #7A1E1E + yellow stitching #E8C13A; King purple #5A2EA6 + gold #E6B422; snake green #7DB343–#5E8C2E w/ yellow button eyes; buttons orange #E8762A / blue #5BB6E0 / grey #BCC4C8; tiles red #C9302C / gold #E6B422 / green #5FA83C; FAIL red #E02828 + gold rim; CTA green #6FB52A. King (bearded, crowned, purple/gold), comedic green serpent w/ mismatched yellow button eyes. Opens near-side 3D, rotates to top-down/tilted maze; board flat top-down; end card flat 2D. Smooth physics button cascades; exaggerated King panic; slow snake descent.

## 6. Win / Fail / Reward
Reward tease early: glowing crown treasure + sparkle (f_002–004). Threat buildup: serpent mouth descending ~25s + early scissors. **FAIL** f_101–103 (explicit). No coins/stars/level-complete.

## 7. End Card / CTA
f_104–118 (~51.5–58.5s): "[TITLE]" logo top; 6 animated 2×3 vignettes (rocks/gate; logs/wood crush; stone wall + water + snake; logs over lava; brick spike floor + debris; stone room water + spikes); green "Play Now!" (hand taps f_109–110, f_113). No store badges.

## 8. Notable for rebuild
- Dual-screen layout: top maze (button-flood physics + King + snake) + bottom match-3, simultaneously. Coupling match-3→buttons→King is the core illusion; here it's **adversarial** (clearing makes it worse) — the fail-bait twist.
- Sewing/craft theme: felt textures, yarn walls, button rigid-body physics (pile settles and rises).
- Yellow plank/dam is a key prop selling his struggle.
- 3 tile types (red block, gold crown, green leaf) on a ~6-wide grid; right columns get buried.
- One royal-gloved pointing hand for both card choice and tile taps.
- Snake descends incrementally each ~0.5s (scripted/timed) to guarantee FAIL ~50s regardless of input.
- Intro bait-and-switch: opens as pin-pull/cut-the-rope (needle/thread/scissors) then pivots to match-3.
- Two-card "choose your tool" beat = a discrete first interactive moment.
- FAIL → end card immediate; no retry. Keep CTA copy "[TITLE]" + "Play Now!".
