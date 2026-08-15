# Temple Escape — "Save the Character" playable ad

An explorer is pinned against a yellow pillar. Rubble rains down onto a grate above him,
piling up against the pillar and driving it — and him — toward a bank of spikes. The grate is
a match-3 board. Clear cells, open holes, and the rubble drains away before it crushes him.

Drain it completely and the pillar retracts, a rope drops from above, the door opens, and he
swings out.

Portrait, mobile-first, one self-contained HTML file. Pixi.js for gameplay, Three.js reserved
for the character rig, Vite for the build.

## Run it

```bash
cd playable
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test         # 71 headless logic tests (22 match-3 + 49 debris sim)
npm run build    # dist/index.html — one file, 2.52 MB raw / 1.26 MB gzip
npm run art      # re-encode assets/art PNGs to WebP at display size (after any art change).
                 # assets/art/vfx/ is listed, not walked — add new effect art to VFX_SHIP.
```

Node LTS (18+). The build output is a single HTML file with everything inlined, which is what
ad networks take.

## Layout

```
playable/       the Vite app
assets/         art, audio, and Blender/PSD authoring sources
ai_logs/        how this was built with AI — start at ai_logs/README.md
README.md       this file
```

## How the brief is met

| requirement | how |
| ----------- | --- |
| character in danger | explorer braced against a plate, pushed toward spikes |
| clear obstacle / threat | rubble mass, visibly piling up, visibly pushing |
| simple interaction | swipe to swap — one gesture, no instructions needed |
| success and failure | rubble fully drained = pillar retracts, rope drops, door opens, he escapes; pillar reaches the spikes = fail |
| retry flow | retry button on both outcomes; instant restart, no replayed intro |
| strong visual feedback | every match physically drains the threat — the rubble level falls as you play |

**Readable in the first seconds** because the screen's geometry states the problem: threat
pinned to one edge, character between the threat and the puzzle, rubble visibly resting on
the board. There is no progress bar and no score — the danger *is* the meter.

## Technical decisions

**2D Pixi for gameplay; Three.js reserved for the character.** The project began as
lightweight 3D and moved to 2D. The gameplay camera is locked straight-on, so 3D bought
nothing a sprite could not do while costing runtime, bundle size and a lighting setup.
Dropping the 3D gameplay path took the bundle from 1.16 MB to under 200 KB gzip. Three.js
stays for the character rig only — pressure is a continuous 0..1 value, so brace→strain has
to blend by animation weight, and a sprite sheet at retina quality would cost 4–5× a low-poly
rig for worse feedback.

**No physics engine.** The references' granular rubble is where the satisfaction lives, but
`cannon-es` was prototyped and dropped. Rocks are 2D sprites picking a tumble frame by speed
(cheap motion blur), all sharing one texture so Pixi batches them into **one draw call**.
Collision against the wall is a grid lookup — "is the cell under this rock still occupied?" —
and rock-vs-rock contact is a coarse occupancy grid, enough for the mass to have depth and
for avalanches to propagate upward. 200–400 rocks, no physics dependency shipped.

**The puzzle is the obstacle, not a meter.** Cleared cells are removed permanently and never
refill, so the board is a wall that erodes as you play. A plate stands exactly while its cell
holds a gem. Plates are never simulated — they stop existing, and the rubble re-tests its
footing.

**A cleared cell throws two effects, on two rhythms.** Stone chips carry the gem's colour and
land as one hit on the frame the plate breaks; a separate emitter (`shine.js`) trails white and
light-gold sparkles in behind them, one every 90 ms, starting a beat earlier when the gem pops.
Chips carry the colour, shine carries the light — tinting both the same hue made the cell read
as one flat wash. The offset stagger is what makes the second effect an echo rather than a
second explosion, and it is why they are two emitters: one emitter is one rhythm. Randomness
lives at the *burst* level as well as the chip level — count, fan direction, spawn point across
the plate face and launch timing all vary per burst, because the eye reads the silhouette of a
spray before it reads any single piece, and six pieces from one point every time reads as canned
however much the individual pieces differ.

**The wall is a stack, and the tiles fall.** Standard match-3 gravity, no refill — and here it
is a physics decision rather than a puzzle one. Every survivor sits at the bottom of its
column, so every hole is at the top: exactly the face the rubble is standing on. Clear a cell
and the wall settles a row, the mass sinks into the pocket it has just eaten, and a column
cleared end to end lets the rubble fall straight out of the shaft.

Clearing *in place* was tried, on the reasoning that the hole should appear where the player
matched. It plays worse than it reads: holes scattered through six courses of plates never line
up into anything the rubble can move through, and the wall stops responding to being cleared at
all — measured, 24 of ~430 rocks drained per round and every round stalled out.

**The hole opens on the frame the plate finishes breaking**, not when the rules cleared the
cell, which is half a second earlier. The simulation reads a separate `plateSolid` grid written
only at the end of an animation the player has watched finish. Before that split, rubble poured
through plates that were still visibly standing.

**A fixed amount of rubble, and it stops arriving once it starts draining.** The round is
allotted enough rock to stand seven cells deep — grate to the top of the screen — and never one
more: 70% is seeded, the rest rains in, and the flow closes for good on the first rock through.
The mass the player is fighting has a size, so being ahead or behind of it is a real thing. It
used to be a tap that ran until 55% of the *board* was cleared, which is the wrong quantity to
measure a physical mass against.

**The pillar creeps; it does not track.** Sustained load walks it toward the spikes over about
seventeen seconds of being fully buried, and it gives ground back when the shaft drains. A
pillar that simply mirrored the current force would stop where the force stopped, which with a
finite mass means the round could never be lost.

**Rules separated from renderers.** `match3.js` and `debris_sim.js` are pure JavaScript with
no Pixi, no Three and no DOM, so they run under plain `node`. That is what makes 71 headless
tests possible, and those tests caught six real defects invisible to the eye — including a
mass that had silently frozen into a dead heap while still rendering as a perfect pile.

**Tuning values are derived, not independent.** The seeded rock count is `capacity ×
startFill`, and the simulation pool is `capacity × 1.15`. Set independently, two of the
combinations lose the game on move one or make it unloseable — the second failing silently in
the direction of "everything looks fine".

## What was intentionally simplified

- **No physics engine**, as above. A coarse occupancy grid at a fixed camera is
  indistinguishable from rigid-body simulation and costs a fraction of the frame.
- **No rock-vs-rock pairwise collision.** Rocks claim cells in a grid rather than testing each
  other. The mass has real depth and avalanches propagate; individual rocks occasionally
  overlap by a pixel, which nobody sees.
- **Fixed 720×1280 design resolution**, scaled to fit and centred. Every layout number in the
  code is in design pixels and never depends on screen size. Costs letterboxing on unusual
  aspect ratios; buys layout code with no responsive branching in it.
- **Three gem colours, not five.** A board that never refills starves at higher colour counts
  — the player ends up reshuffling instead of playing. Three clears ~88% of the board in about
  ten moves.
- **The intro is one beat, not a cutscene.** A sub-second drop-in, driven off the frame tick
  rather than a tween, so it cannot stall with the board disabled. The scenic 3D intro is
  designed and parked; this is the honest placeholder for it.

## What was prioritised, and why

**The causal loop first, everything else after.** The weak version of this genre clears tiles,
increments a hidden meter and plays a rescue animation at 100%. The strong version has the
cleared tiles physically do something. Getting that right consumed most of the project —
three design revisions, and the architecture was restated three times before it was captured
correctly. Everything else in a playable ad is polish on top of whether that loop is real.

**Correctness of the rules over surface polish.** The pure-logic split and its tests came
before art, audio or UI. A dead-heap rubble mass looks perfect in a screenshot; the only
thing that catches it is executing the rules and asserting on the result.

**Original assets over fast assets.** During tuning, art from a shipped commercial creative
was used as a clearly-marked placeholder so gameplay could be balanced against
reference-quality visuals. It reached 19% of the bundle, and all of it has been removed —
none is present in this delivery, in source or in build. The art loader fails soft, so the
game is fully playable right now with vector shapes standing in for art still being authored.

## Current state — honest inventory

**Playable end to end with the real art.** Scene composed from the layout PSD, board sitting in
its painted recess, rubble in the delivered rock sheets, the pillar driven by pressure with the
hero riding it, match chips and their shine echo, audio, stamina meter, tutorial hand and
banner, win and fail end cards, retry, CTA. Portrait and landscape both reflow. 71 tests
passing. **2.52 MB raw / 1.26 MB gzip** as one self-contained HTML file.

**Known flake:** the 49 debris tests are not deterministic — `debris_sim.js` calls
`Math.random()` in eleven places and takes no injectable `rng`, unlike `match3.js`. Seen once as
two failures in ~21 runs. Not yet fixed; the fix is to mirror what `Match3` already does.

**The instruction banner is a first-move tutorial, not furniture.** The panel and its text fade
out together on the first successful swap — they have done their job, and the screen is worth
more than the reminder. The same panel comes back for HURRY UP when the pillar crosses the
danger line, and leaves again when the shaft drains. A retry starts over from the instruction,
because a fresh round starts over from "what do I do".

**Placeholder:** the character is the PSD's painted explorer rather than the rigged glTF, which
has not been delivered. `hero3d.js` is written and fail-soft — dropping `hero.glb` into
`assets/art/` upgrades him with no code change, including the pressure-driven strain blend that
`game.js` already feeds every frame.

**Not built:** the rope beat of the outro — there is no rope layer in the PSD, so the escape
runs pillar-release → run to door → end card. A balance pass against real play, and
`walkthrough.mp4`, are both outstanding.

**Carried cost worth naming:** Three.js is ~151 KB gzip of the bundle for a rig that has not
arrived. It buys nothing until `hero.glb` lands, and removing it is one import.

## What I'd improve with more time

1. **Finish the character.** The rig is the single biggest gap between this and the reference
   bar. Pressure is already a continuous value the animation can blend against — the plumbing
   is there, the asset is not. A character who visibly strains harder as the rubble builds is
   most of the emotional payload of the genre.
2. **The scenic intro.** Designed and parked: the explorer reaches for the chest, the floor
   gives way, and he lands in the chamber. Three or four seconds that make the danger a story
   rather than a diagram.
3. **An audio budget.** All eighteen clips are wired and the interesting pieces are done — the
   rubble rumble is a held loop whose gain follows *flow*, how much mass is moving, rather than
   a one-shot per impact that either machine-guns or needs throttling; and the six merge
   recordings are a ladder that climbs one rung per match and drops back after a couple of
   seconds without one, so keeping the combo going is audible. What is left is size: 564 KB of
   mp3 is the single biggest thing in the bundle now. Mono at 64 kbps and trimming the
   four-second stone tails to their first second would roughly halve it.
4. **A real balance pass.** Inflow rate, capacity and start fill are currently set to sensible
   values, not tuned ones. The target feel is a first match that visibly helps and a mid-game
   moment where the player is genuinely behind.
5. **Squeeze the bundle.** The single file is 2.52 MB raw, and network ceilings in this format
   run from 2 MB to 5 MB depending on the network — so this needs trimming before it can go
   everywhere. The two levers, largest first: the 564 KB of audio (see above), and Three.js at
   ~151 KB gzip.
6. **Wire the tutorial mask.** The hint logic already finds a valid pair, and the instruction
   banner and hand already clear themselves on the first swap; dimming everything except that
   pair until the swap happens is a small change with a large effect on the first five seconds,
   which is the part of an ad that matters most.

## AI usage

Used heavily, and across the whole project rather than just the code — documented in
[`ai_logs/`](ai_logs/README.md), including the places it was wrong.

Concept and character design in ChatGPT; the character mesh generated from that concept in
Tripo3D and adjusted in Blender; animation retargeted from Mixamo. The 2D game art generated
and iterated in ChatGPT, separated into discrete layers with Codex, then settled into the
final layout by hand in Photoshop. Code, analysis and documentation with Claude Code.

Every design decision and all final compositing are human. `ai_logs/01-workflow.md` has the
pipeline diagram and who did what at each handoff.

## Assets and licensing

All assets are original or open-licensed. No typeface ships — every word on screen is baked
art from the layout PSD, and the build loads no font file.
Reference creatives were analysed, as the brief invites; no asset or code from any commercial
title is present in this project.
