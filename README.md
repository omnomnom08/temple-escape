# Temple Escape — "Save the Character" playable ad

An explorer drops into a sealed chamber and is pinned against a yellow pillar. Rubble rains down
onto a grate above him, piling up against the pillar and driving it — and him — toward a bank of
spikes that comes out of the wall to meet him. The grate is a match-3 board. Clear cells, open
holes, and the rubble drains away before it crushes him.

Drain it completely and a rope swings in from above the screen. He takes it at the top of its arc,
and only then does the pillar go over — breaking apart behind him as he rides out.

Portrait, mobile-first, one self-contained HTML file. Pixi.js for the game, Three.js for the
character rig, Vite for the build.

## Where to look

There is more written down here than a reviewer needs, so: **this file is the deliverable, and the
rest is depth if you want it.**

- **Five minutes** — play it (below), then read *The art pipeline*, *What was prioritised*, and
  *What I'd improve*. That is the whole argument.
- **The brief's four questions** are four headings in this file: technical decisions, what was
  intentionally simplified, what was prioritised and why, what I'd improve with more time.
- **Optional** — [`ai_logs/`](ai_logs/README.md) is how it was built and where AI was wrong;
  [`analysis/`](analysis/README.md) is the pre-production research the quality bar came from;
  [`PLAN.md`](PLAN.md) is the working engineering record. None of it is required reading.

## Run it

```bash
cd playable
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test         # 83 headless logic tests (22 match-3 + 61 debris sim)
npm run build    # dist/index.html — one file, 3.07 MB raw / 1.52 MB gzip
npm run art      # re-encode assets/art PNGs to WebP at display size (after any art change).
                 # Works from explicit ship lists, not by walking the folders — add new art
                 # to LAYERS_SHIP / VFX_SHIP in tools/optimize-art.mjs.
```

Node LTS (18+). The build output is a single HTML file with everything inlined, which is what ad
networks take.

## Layout

```
playable/       the Vite app
assets/         art, audio, the character rig, and Blender/PSD authoring sources
ai_logs/        how this was built with AI — start at ai_logs/README.md
analysis/       pre-production research: the references taken apart, and what it changed
PLAN.md         the engineering record: rig measurements, investigations, what is still open
README.md       this file
```

## How the brief is met

| requirement | how |
| ----------- | --- |
| character in danger | a rigged explorer braced against the pillar, visibly tiring in three stages as it drives him back |
| clear obstacle / threat | rubble piling up and pushing, plus spikes emerging from the wall on the same 0..1 pressure |
| simple interaction | swipe to swap — one gesture, taught by a hand and a hinted pair, then never mentioned again |
| success and failure | drained = a rope swings in, he takes it, and the pillar goes over behind him as he rides out; pillar reaches the spikes = fail |
| retry flow | retry on both outcomes; instant restart, no replayed intro |
| strong visual feedback | every match physically drains the threat — the rubble level falls, the pillar gives ground, the stamina badge refills, and his pose recovers a stage |

**The first three seconds are designed, not inherited.** The brief asks that the player understand
the danger, the task and the goal within a few seconds; in this format those seconds are also the
only ones you are guaranteed, because the ad is competing with a thumb already moving. So the
opening is **active from frame one — there is no static title card, no logo hold, and nothing the
player waits through:**

| ~when | what moves | what it tells you |
| --- | --- | --- |
| 0.0s | camera tight at 2×, clamped on the **open hole in the ceiling** | *something is about to come through there* |
| 0.0–0.5s | he falls through it | *this is who you are watching* |
| 0.5s | lands, squashes, dust bursts — and the ceiling seals behind him | *he is trapped, he didn't choose this, and the way out just closed* |
| 0.5–1.5s | camera pulls back to the whole chamber | *here is the room, the rubble already on the grate, and the spikes waiting at the edge* |
| ~1.5s | the hand points; two gems pulse and sparkle | *and here is what you do about it* |

Each beat is motion carrying one piece of information, in the order the player needs it. The shot
choice at 0.0s is the load-bearing one: it does **not** open on the character. It opens on the hole,
so his arrival is an event the player is already waiting for rather than a fact they are shown —
which is also why the camera needs no special case for the fall, since it is simply following
something that has not entered frame yet.

After the motion stops, the staging carries it: threat pinned to one edge, character between the
threat and the puzzle, rubble visibly resting on the board. The screen's geometry states the problem
on its own.

**The threat is not a timer.** The reference creatives and the competitor all use an advancing snake;
this uses a physical mass that the player's own matches drain. That was a deliberate choice to solve
the brief's actual requirement — *the player should understand what the danger is* — with something
the genre had not already worn out. It is also what makes the loop causal rather than scored: there
is no hidden meter, because the rubble **is** the meter.

## Where the quality bar came from

The brief supplied four reference creatives and asked for comparable quality and readability without
copying them. Both halves of that need the same thing: the references taken apart properly. You
cannot deliberately match a bar you have not measured, and you cannot deliberately differ from
something you have only glanced at.

So they were. All four pulled to stills at 2 fps with ffmpeg — 481 frames — and read shot by shot:
what is on screen in the first three seconds, how the threat is introduced, where the fail lands,
how the end card is structured. Separately, a shipped creative from the same genre had its live
tuning configuration extracted and read for technique and numbers. The full write-ups are in
[`analysis/`](analysis/README.md), including a table mapping each finding to what shipped.

The titles behind those creatives are deliberately not named in the write-ups. Every finding is
about technique — asset budgets, tint pipelines, audio gating, module structure — and none of it
needs a brand attached.

Four things that came directly out of it and are in the build: **no physics engine** (their debris
runs on a hand-written solver, not a library — so does this); **flow-gated landslide audio** rather
than one-shot-per-impact; **six variants of the match sound**, taken further here as a combo ladder;
and **display text as baked art**, not live font rendering, which is why the bundle ships no
typeface.

And one thing that came out of it as a decision *not* to follow: every reference solves time
pressure with an advancing snake. Seeing that they all made the same choice is what made choosing
differently a decision rather than an accident.

**The line:** technique, structure and numbers were taken; assets, code and branding were not.
Placeholder art from a shipped creative was used during tuning and reached 19% of the bundle — all
of it has been removed, and none is present in this delivery in source or in build. A HAR capture
and, later, a second existing engine were both offered as sources of debris logic and both declined,
on the grounds that lifting an implementation is the thing the brief actually prohibits.

## The art pipeline, and the decisions in it

The majority of the hard calls in this project are on the art side of the art/engineering seam, so
they get their own section rather than being scattered through the one below.

**The PSD is a layout system, not a mockup.** `design.psd` is authored on a **square 1280×1280
canvas**, and the HUD elements sit *off-frame* rather than in their portrait positions. Both look
like mistakes and neither is: the square backdrop cover-scales correctly for portrait *and*
landscape from one document, and the HUD is parked outside the frame because it is shared between
orientations and anchored at runtime. Landscape support went from unplanned to in-scope on the
strength of that one decision — the art was already built for it.

**Placement is exported, not retyped.** A dependency-free extractor writes one PNG per layer plus a
`manifest.json` carrying every layer's box and opacity in document space. Runtime code asks the
manifest where things go, so **document coordinates never exist twice** and cannot drift from the
PSD. The lookup is deliberately split three ways: `box()` returns placement with no art — which is
how one texture serves two different boxes, as the CTA does with the win card's button — `url()`
returns art with no placement, and `layer()` insists on both.

**Layout was locked across a change of dimension.** When the puzzle moved from 3D to 2D, the
instruction was that the geometry and placement stay exactly as the 3D scene had them. That is why
the painted chamber reads as the same room the 3D camera framed, and why the move cost a re-author
of the art rather than a re-derivation of the whole scene.

**Art was re-exported to make motion possible.** The first extract had the trap as two flattened
images, and that is precisely why nothing in it could move: the ceiling beam was baked into the wall
bars, and the spike bank was already masked down to its tips. Re-exported as six pieces, with the
wall silhouette — sockets punched out — used as an **inverse alpha mask** over the rods, so a spike
is occluded by the wall it emerges through. The same pass supplied the rectangular mask that reveals
the ceiling beam left-to-right after he lands. Diagnosing "this cannot animate because of how it was
exported" is the whole job, and it was diagnosed from the document, not from the code.

**The character's animation is authored, not downloaded.** Mixamo supplied the pose library and the
retarget; the three stamina idles were then posed by hand as *three readings of the same brace at
three degrees of exhaustion*. No clip library has an entry for "the same man, more tired". That
authorship is also what set the runtime architecture: the phases are far enough apart (>100° at the
upper arm) that a weight blend between them is not a pose, so the rig runs as a three-state machine
rather than the continuous blend it was originally written for.

**His stance is tuned against the contact point, not against the body.** He stands at a different
distance from the pillar in each pose — fresh, he holds it at arm's length; spent, he has been
driven onto it — and the number that has to stay still is not where his *feet* are, it is where his
*hands meet the stone*. So the standoff is tuned as a sum: stance offset plus reach, where reach is
the front-most hand bone measured off the posed skeleton rather than guessed.

|  | standoff | reach | contact |
| --- | --- | --- | --- |
| `idle_0` | −8 | 69.4 | 61.4 |
| `idle_1` | 21 | 36.0 | 57.0 |
| `idle_2` | 36 | 21.0 | 57.0 |
| `push` | 0 | 59.0 | 59.0 |

Hold the contact column steady and he reads as bracing; let it drift and he floats. `idle_1` shipped
at 50.0 for a while and was the one pose that visibly did, because it curls both arms toward his
chest and the stance did not make that up.

Two things fell out of doing it this way. The marks sit ~18 units *past* the column's painted edge,
and that overlap is correct rather than an error to tune out — the front-most bone is a fingertip
joint, and the flesh behind it is what the eye reads as contact. Putting the joint itself on the
face renders as a man reaching for a wall he cannot quite touch; it was tried, filmed, and worse.
And the table is keyed on the **clip**, not on the stamina phase — `push` plays throughout every
recovery, and keying on phase slid his body 44 units underneath a pose that never changed.

**The rig was optimised at the source, not in code.** The first GLB was 1.25 MB, and **79 of its 107
skeleton joints carried zero vertex weight** — the IK/FK control rig, animated in full by all six
clips. A clean deform-only FBX export fixed it upstream:

| | before | after |
| --- | --- | --- |
| File | 1,254,308 B | **631,692 B** |
| Skin joints | 107 (28 weighted) | 28 (28 weighted) |
| Nodes | 129 | 30 |
| Animation channels per clip | 321 | 87 |

Verified equivalent rather than merely smaller: identical mesh (9,395 tris), identical bind pose,
identical loop closure on every clip, identical hip paths.

**Texture decisions made against how the asset is actually drawn.** The rig's palette atlas ships
*beside* the GLB rather than embedded in it — the same 512×512 image cost 163 KB as an embedded PNG
against 9 KB as WebP. And mipmaps are **off** on it, because it is a palette: ~30 vertical colour
strips across 512 px, so at the size the hero renders, mip levels blend neighbouring strips and the
colours go muddy. That is a bug you can only predict by knowing what the texture *is*.

**Encoding tuned per file, from measurement.** WebP stores alpha as its own plane, and the default
quality of 90 is the wrong trade for a layer that *is* its alpha. The panic vignette is one flat
colour over a full-frame ramp: at 90 it is 276 KB, at 70 it is 39 KB, and the ramp deviates from the
source by 3.8/255 on average. The three endcard ray layers are the same shape of problem and went
172 KB → 77 KB. In the other direction, the sound icons and confetti scraps stay **PNG**, because at
50×50 the WebP container overhead makes them measurably *bigger* (1542 vs 1429 bytes). Neither
default was assumed.

**The backdrop is one flattened draw.** Wall, fog, door, its shadow and the step stone are baked into
a single image in Photoshop rather than composited at runtime. They never move relative to each
other, so five sprites and five draw calls bought nothing — and the re-bake also closed a seam at the
top of the frame that runtime compositing had been papering over.

## Technical decisions

**2D Pixi for the game; Three.js for the character.** The project began as lightweight 3D and moved
to 2D ([`ai_logs/00-origins.md`](ai_logs/00-origins.md) has that decision and what it cost). The
gameplay camera is locked straight-on, so 3D bought nothing a sprite could not do while costing
runtime, bundle size and a lighting setup — dropping the 3D gameplay path took the bundle from
1.16 MB to under 200 KB gzip. The character kept it, and earns it: stamina is a continuous
0..1 that has to drive both his pose and his distance from the pillar, and a sprite sheet at retina
quality would cost several times a low-poly rig for less. The rig also solves a layering problem
nothing else could — see the spikes below.

**The character is three states, not a blend.** `hero3d.js` was originally built to run a braced
idle and a strain pose simultaneously and cross-fade them by *weight*. The delivered clips killed
that: adjacent stamina poses differ by more than 100° at the upper arm, so a partial weight between
them puts the limb through a midpoint that is not a pose. They are states. So it is a three-state
machine with a cross-fade on transition, driven off the same `push` value as the stamina badge —
one signal, so the gauge and the character cannot disagree — with hysteresis on each threshold so a
hovering value does not chatter.

**The spikes draw on the character's canvas.** The rig renders to its own WebGL canvas above every
Pixi layer, so nothing in Pixi can ever be in front of him — and spikes that stop behind the
character do not read as spikes reaching him. The lifted tips were moved onto *his* canvas, because
it is the only layer that can be in front of him. The same fact has a cost paid explicitly: living
above Pixi means living above the end cards too, so the tips are struck when a card comes up.

**The rope is closed-form, not simulated** — and that was a scope call, not a technical one. Two
solvers were built and thrown away: a Verlet chain, then angular springs, which gave a lovely bow
and then rang once the rope was also being pulled onto a moving hand every frame. The instruction
that ended it was *"no dangle or complexcity, we need some simple solution cuz it's just the outro"*
— correct, and it arrived while I was still trying to make the physics behave. The beat is under two
seconds, most of it under a fade, and it did not need a solver that could surprise anyone.

The shipped version offsets each segment from the driven angle in proportion to swing speed, a
first-order expansion of "sample the driven angle a moment ago". It bows against the direction of
travel and straightens at the ends of the arc, which is what a rope on a pendulum does, and nothing
accumulates between frames — so it cannot ring, drift or behave differently at 30fps than at 120.
The swing itself is one `sine.inOut` tween, because simple harmonic motion between two extremes *is*
a sine.

**No physics engine.** The references' granular rubble is where the satisfaction lives, but
`cannon-es` was prototyped and dropped. Rocks are 2D sprites picking a tumble frame by speed (cheap
motion blur), all sharing one texture so Pixi batches them into **one draw call**. Collision against
the wall is a grid lookup — "is the cell under this rock still occupied?" — and rock-vs-rock contact
is a coarse occupancy grid, enough for the mass to have depth and for avalanches to propagate
upward. 200–400 rocks, no physics dependency shipped.

**The puzzle is the obstacle, not a meter.** Cleared cells are removed permanently and never refill,
so the board is a wall that erodes as you play. A plate stands exactly while its cell holds a gem.
Plates are never simulated — they stop existing, and the rubble re-tests its footing. The stamina
badge added later reports the same physical quantity the scene already shows; it is a readout, not
the mechanic.

**The stamina gauge is the shipped art, masked.** A Graphics pie wedge over the ring and a rising
waterline up the arm, rather than a Graphics approximation of them. The radius, thickness and
antialiasing are then the artwork's own and survive any re-export, where an approximation has to be
remeasured against each one.

**A cleared cell throws two effects, on two rhythms.** Stone chips carry the gem's colour and land
as one hit on the frame the plate breaks; a separate emitter (`shine.js`) trails white and
light-gold sparkles in behind them, one every 90 ms, starting a beat earlier when the gem pops.
Chips carry the colour, shine carries the light — tinting both the same hue made the cell read as
one flat wash. The offset stagger is what makes the second effect an echo rather than a second
explosion, and it is why they are two emitters: one emitter is one rhythm. Randomness lives at the
*burst* level as well as the chip level — count, fan direction, spawn point across the plate face
and launch timing all vary per burst, because the eye reads the silhouette of a spray before it
reads any single piece.

**The wall is a stack, and the tiles fall.** Standard match-3 gravity, no refill — and here it is a
physics decision rather than a puzzle one. Every survivor sits at the bottom of its column, so every
hole is at the top: exactly the face the rubble is standing on. Clear a cell and the wall settles a
row, the mass sinks into the pocket it has just eaten, and a column cleared end to end lets the
rubble fall straight out of the shaft.

Clearing *in place* was tried, on the reasoning that the hole should appear where the player
matched. It plays worse than it reads: holes scattered through six courses of plates never line up
into anything the rubble can move through, and the wall stops responding to being cleared at all —
measured, 24 of ~430 rocks drained per round and every round stalled out.

**The hole opens on the frame the plate finishes breaking**, not when the rules cleared the cell,
which is half a second earlier. The simulation reads a separate `plateSolid` grid written only at
the end of an animation the player has watched finish. Before that split, rubble poured through
plates that were still visibly standing.

**A fixed amount of rubble, and it stops arriving once it starts draining.** The round is allotted
enough rock to stand seven cells deep — grate to the top of the screen — and never one more: 70% is
seeded, the rest rains in, and the flow closes for good on the first rock through. The mass the
player is fighting has a size, so being ahead or behind of it is a real thing.

**The pillar creeps; it does not track.** Sustained load walks it toward the spikes over about ten
seconds of being fully buried, and it gives ground back when the shaft drains. A pillar that simply
mirrored the current force would stop where the force stopped, which with a finite mass means the
round could never be lost.

**Rules separated from renderers.** `match3.js` and `debris_sim.js` are pure JavaScript with no
Pixi, no Three and no DOM, so they run under plain `node`. That is what makes 83 headless tests
possible, and those tests caught seven real defects invisible to the eye — including a mass that had
silently frozen into a dead heap while still rendering as a perfect pile, and a wall that gave
ground and left the pile behind, which is what made the round unloseable for most of the project.

**Tuning values are derived, not independent.** The seeded rock count is `capacity × startFill`, and
the simulation pool is `capacity × 1.15`. Set independently, two of the combinations lose the game
on move one or make it unloseable — the second failing silently in the direction of "everything
looks fine".

**The bundle is a function of what is used, not what exists.** Every shipped layer is an explicit
import in `layers.js`, every clip an explicit import in `audio.js`, and the three `import.meta.glob`
calls in `art.js` are deliberately narrow. An early wide glob quietly inlined megabytes nothing
referenced; narrowing it was worth more than every compression step combined. It also means "which
assets does the build actually contain" is answerable by reading, which is what made a late cleanup
pass cheap.

## What was intentionally simplified

- **No physics engine**, as above. A coarse occupancy grid at a fixed camera is indistinguishable
  from rigid-body simulation and costs a fraction of the frame.
- **No rock-vs-rock pairwise collision.** Rocks claim cells in a grid rather than testing each
  other. The mass has real depth and avalanches propagate; individual rocks occasionally overlap by
  a pixel, which nobody sees.
- **No rope solver**, as above — a three-second scripted beat has no use for something that can be
  surprising.
- **Fixed 720×1280 design resolution**, scaled to fit and centred. Every layout number in the code
  is in design pixels and never depends on screen size. Costs letterboxing on unusual aspect ratios;
  buys layout code with no responsive branching in it.
- **Three gem colours, not five.** A board that never refills starves at higher colour counts — the
  player ends up reshuffling instead of playing. Three clears ~88% of the board in about ten moves.
- **No fail animation.** The card cuts in before impact, and the spikes go home under its fade. The
  crush is what killed him; it does not need to stay on screen arguing about it.

## What was prioritised, and why

**The causal loop first, everything else after.** The weak version of this genre clears tiles,
increments a hidden meter and plays a rescue animation at 100%. The strong version has the cleared
tiles physically do something. Getting that right consumed most of the project — three design
revisions, and the architecture was restated three times before it was captured correctly.
Everything else in a playable ad is polish on top of whether that loop is real.

**Correctness of the rules over surface polish.** The pure-logic split and its tests came before
art, audio or UI. A dead-heap rubble mass looks perfect in a screenshot; the only thing that catches
it is executing the rules and asserting on the result. The same instinct found the bug that made the
round unloseable, which had survived two rounds of reading the code and one confident wrong guess
written down in the plan.

**The character over everything else in the second half.** It is the single largest gap between this
and the reference bar, it sat on the critical path twice, and the loader was therefore written
*first*, against a placeholder, so the rig's arrival would be a file drop rather than an
integration. It was.

**Original assets over fast assets.** During tuning, art from a shipped commercial creative was used
as a clearly-marked placeholder so gameplay could be balanced against reference-quality visuals. It
reached 19% of the bundle, and all of it has been removed — none is present in this delivery, in
source or in build. The art loader still fails soft, so the game stays playable with vector shapes
if an asset ever goes missing.

**The finished loop over the better opening.** The creative was designed as two acts; the first —
an upper temple room, a chest under god rays, a hidden step, the floor giving way — was blocked out
in 3D with a marker-driven camera and then **cut**, so the match-3 could be made to feel right. That
is the largest single scope decision in the project and it was made in the correct direction: an ad
with a beautiful opening and an unsatisfying loop fails, where the reverse merely underperforms. The
blockout ships as `assets/source/blender/world.blend` rather than being quietly dropped, because a
cut act you can still show is a scope decision, and one you cannot is just a missing feature.

**The deadline over the shortcut.** Offered the choice between a 2D layered hero that would hit the
original date and a rigged 3D character that would not, the call was to keep the rig and let the date
move. That is why the character strains in three readable stages instead of swapping between two
sprites, and it is most of the emotional payload of the genre.

## Current state — honest inventory

**Complete end to end.** Intro camera pull-back and landing with dust; the board on its painted
recess; rubble in the delivered rock sheets; the pillar driven by pressure with the rigged hero
riding it through three stamina stages; spikes advancing from the wall on the same value; the red
panic frame and a heartbeat that quickens as the last of his ground goes; match chips and their
shine echo; a hint hand, a hinted pair and a drifting sparkle; the stamina badge; audio; the pillar
toppling into the shaft as debris; the rope outro; win and fail cards with confetti, a lured chest
and a live CTA; a mute toggle; retry. Portrait and landscape both reflow. 83 tests passing.
**3.07 MB raw / 1.52 MB gzip** as one self-contained HTML file.

**Known flake, now pinned down.** The debris suite is not deterministic: `debris_sim.js` calls
`Math.random()` in eleven places and takes no injectable `rng`, unlike `match3.js`. Measured at
**2 failing runs in 25 (~8%)**, and it is always the same pair:

```
FAIL  three times the rubble pushes MORE than three times as hard   8.4 -> 21.6
FAIL  force per rock rises with depth                             0.084 -> 0.072
```

Those are one measurement seen twice — with 3× the rocks the total force came in under 3×, so the
per-rock figure fell instead of rising. Both assert a *statistical* property of a random pile
against a single sample, so on an unlucky seed the pile arches and the load bridges instead of
transmitting. The assertions are correct about the physics; the test is wrong to check them once.
Not fixed, and the fix is two-part: inject an `rng` the way `Match3` already accepts one, and assert
the trend across a handful of seeds rather than one.

**Outstanding:** `walkthrough.mp4`, a balance pass against real play, and a bundle pass that is
underway as this is written.

**Scope, stated plainly:** the creative was designed as two acts and this delivers the second. The
first — the upper temple room, the chest, the hidden step, the floor giving way — is blocked out in
`assets/source/blender/world.blend` and described in
[`ai_logs/00-origins.md`](ai_logs/00-origins.md). It still runs in the project this one was seeded
from, so it can be captured as reference footage alongside the walkthrough.

## What I'd improve with more time

1. **A real balance pass.** Inflow rate, capacity and start fill are set to sensible values, not
   tuned ones. The target feel is a first match that visibly helps and a mid-game moment where the
   player is genuinely behind. This is the one that would most change how the ad plays.
2. **Give him a face.** The single biggest emotional return left on the table, and the asset is
   already built for it: the head was modelled **with an inner mouth**, so it can open. What the
   shipped GLB does not yet carry is any way to drive it — 28 deform joints, `mixamorig:Head` and
   nothing below it, no blendshapes. Adding a small face rig or a handful of morph targets on
   geometry that already exists would put strain, panic and relief on his features instead of only
   in his shoulders. In a genre whose entire job is *make the player care about this person in the
   next three seconds*, that is worth more than anything else on this list.

   With it, one beat I would add: **break the fourth wall.** A single look straight down the lens —
   at the moment the spikes get close, or the instant he is free — is the cheapest, most direct
   emotional hook a rescue ad has, and it is the thing a face unlocks that a body cannot do.

3. **An audio budget.** All 21 clips are wired and the interesting pieces are done — the rubble
   rumble is a held loop whose gain follows *flow*, how much mass is moving, rather than a one-shot
   per impact that either machine-guns or needs throttling; and the six merge recordings are a
   ladder that climbs one rung per match and drops back after a couple of seconds without one, so
   keeping the combo going is audible. What is left is size: the audio is the largest single block
   in the bundle now. Mono at 64 kbps and trimming the four-second stone tails to their first second
   would roughly halve it.
4. **Determinism in the debris tests.** Two known assertions fail about 8% of the time, for the
   reason above — they sample a random pile once and assert a statistical property of it. Inject an
   `rng` the way `Match3` already accepts one, and assert the trend across several seeds. An
   intermittent red makes a real regression easy to dismiss as the flake, which defeats the reason
   the suite exists.
5. **A tutorial mask.** The hint logic already finds a valid pair, the hand and banner already clear
   themselves on the first swap, and the hinted gems already pulse and sparkle. Dimming everything
   *except* that pair until the swap happens is a small change to the part of an ad that matters
   most.
6. **Let the fall run longer.** The drop is half a second, and it should breathe. Falling is the
   hook (see below), and half a second is barely enough to register it before the round starts —
   a longer descent past passing stonework would earn the landing and let the danger land before
   the puzzle asks for anything.

   **I skipped it deliberately, because it is an art change, not a code change**, and there are two
   dependencies rather than one. First, there is nowhere to fall *from*: he starts one body height
   above the document top and the backdrop **is** the document, so there is no painted shaft above
   the ceiling for a camera to travel up into. Second, `T_FALL` is pinned to 0.50s because that is
   where the `land` clip plants its feet — stretching the drop without a loopable mid-air clip in
   front of it just holds a landing pose in the air. So it needs new backdrop art *and* an extra
   animation, and at that point it is the same conversation as the first act below. Worth doing
   together, not separately.

7. **The first act.** This is the largest gap between what the creative was designed to be and what
   it delivers, and it is not an idea — it is **built, blocked out, and cut**. The explorer enters an
   upper temple room; a chest sits at the far end lit by god rays; he crosses toward it, nearly
   reaches it, steps on a hidden stone, and the floor gives way beneath him. **The playable in this
   folder starts where he lands.**

   **The fall was the point of it, and that was not a scenic choice.** It is a hook I have watched
   work, from experience shipping creatives — the falling-from-height openings that went viral in
   this category a few years ago were not popular because falling looks nice. A fall survives being
   scrolled past, because direction, speed and consequence read in one frame with the sound off. It
   takes attention involuntarily, because falling is a primal threat signal and you look before you
   decide to. It answers *why is he here* with no text and no voiceover, in a format that cannot
   afford either. And it **manufactures a victim** — a character who walked in could walk out, so
   the player's help is optional, where a character who fell is helpless by construction and the
   puzzle becomes the only way out. The whole rescue premise rests on that.

   The fifth reason is the one the cut cost most: **reach, then lose.** He nearly touches the chest
   and it is taken from him. The references all use loss aversion at the *end*, as a scripted FAIL;
   putting it at the front instead leaves something concrete to win back, which is what turns the
   win card from a reward into restitution.

   It ran, in 3D, driven by camera markers baked into the scene — `assets/source/blender/world.blend`
   is that scene, and it ships for this reason rather than as a leftover. It was cut because a
   playable ad with a beautiful opening and an unsatisfying loop fails, where the reverse merely
   underperforms, and the rubble took three separate investigations to make it feel like mass. The
   delivered intro is the same argument compressed by an order of magnitude — he still falls in,
   because that beat was never negotiable; it just no longer has a room above it to fall *from*.
   [`ai_logs/00-origins.md`](ai_logs/00-origins.md) has the marker table, the timeline, and the
   decisions in the order they were made.

   One piece of it did survive: the chest lit by god rays, the thing he was reaching for at the
   start, is the win card. The two acts turned out to be the same shot at either end of the round.

## AI usage

Used heavily, and across the whole project rather than just the code — documented in
[`ai_logs/`](ai_logs/README.md), including the places it was wrong.

Concept and character design in ChatGPT; the character mesh generated from that concept in Tripo3D
and cleaned up in Blender; the animation authored by hand from Mixamo poses — the three stamina
idles are three readings of the same brace at three degrees of exhaustion, which is a thing you pose
deliberately rather than download. The 2D game art generated and iterated in ChatGPT, separated into
discrete layers with Codex, then settled into the final layout by hand in Photoshop. Code, analysis
and documentation with Claude Code.

The last stretch ran up to three agents in one working tree at once — one on the rig, one on the trap
art, one on the rope — which needed rules of its own: one agent owns `game.js` at a time, the others
are told in their prompt which files they may not open, and every commit stages explicit paths. Those
rules were written *before* the first collision, not after it. `ai_logs/01-workflow.md` has the
pipeline diagram and who did what at each handoff; `ai_logs/04-finishing.md` has the rest.

**The line was drawn deliberately, and it held.** AI wrote the code, the analysis and this
documentation, generated the concept and the 2D passes, and produced the first mesh. Every design
decision is human — the mechanic, the threat, the loop, the two-act structure and what to cut from
it. So is every piece of final art: the layers are corrected and composited by hand, because the
consistent failure mode of generated art is *drift*, and six independently generated passes disagree
about lighting, palette and perspective the moment you layer them. The Photoshop pass is what makes
them read as one room. So is the animation, the mesh cleanup, the audio, and the balance.

AI was also deliberately kept off three things: **design decisions**, where its useful contribution
was arguing about implementation cost rather than choosing what to build; **balance numbers**, which
are tuned by playing, though it did make them *derived* so they cannot be set to a silently broken
combination; and **final art judgement**, for the drift reason above.

The logs record where it was wrong, on purpose — a confident wrong diagnosis written into the plan
document that was then believed twice, an over-swept simulation that nearly produced a much smaller
stamina badge than the design wanted, and three separate feel complaints where the first fix was the
cause of the next one. Those are more useful than the successes.

## Assets and licensing

All assets are original or open-licensed. No typeface ships — every word on screen is baked art from
the layout PSD, and the build loads no font file. Reference creatives were analysed, as the brief
invites; no asset or code from any commercial title is present in this project.
