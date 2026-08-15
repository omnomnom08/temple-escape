# 04 — Finishing

`02` and `03` stop where the rubble work stopped. Everything after it is here: the character
arriving, the outro, the trap, the round's UI, and the pass that took the unused art back out.

This file merges what those two split. That stretch came in short, feature-shaped sessions where
the prompt, the decision and the bug are one beat, and separating them across two documents would
have meant writing each of them twice. Prompts are verbatim, typos included, same as `03`.

Two facts worth stating before any of it: the character was still a painted placeholder when `02`
was written, and the outro still ran him to a door. Both changed here, so anything in `02` that
depends on either is superseded by this file.

---

## The loss that could not happen

> the bug with lose is not fixed yet. after matching first tiles the stamina never drops down,
> the lose never happens for me

**What this produced.** The most useful debugging of the project, and a lesson about this
repository's own notes.

`PLAN.md` named a prime suspect: `RELIEF_SECONDS` (6s) out-running `CREEP_SECONDS` (14s), so
recovery beat decay and `push` could never reach 1. Instrumented over a hands-off round, that was
simply false. Only 7% of frames ever relieve, and `push` does not decay — it *plateaus* at 0.43
and sits there. `CRUSH_FORCE` was innocent too; `rawPressure` hits 1.000 repeatedly.

The real cause was a feedback loop through the pillar. `game.js` drives `bounds.left` off
`scene.pillarRight`, so the shaft's left wall retreats as `push` grows. Settled rock sleeps, and
`setLeftBound` only woke the mass in the *advancing* case — nothing woke it when the wall backed
away. So the pillar slid left, the pile stayed put, a gap opened, and `wallForceLeft` — which
samples one pack cell at `bounds.left` — ended up measuring the gap. Load at the face fell 418 → 20
and `rawPressure` with it, 1.00 → 0.07.

**Being pushed was the thing that stopped the pushing.** Held the wall still as a control: fail at
15.7s. The fix is one line — `wakeColumn` the face slice when the wall gives ground. Deliberately
not a ratchet: the mass visibly detaching from the pillar it was supposed to be crushing was the
actual bug, and a ratchet would have hidden it behind arithmetic.

> the loose state takes to long, can you do the fixes what you want.

`CREEP_SECONDS` 14 → 10. 14 had never been measured against a round that could actually end; once
one could, it meant 17.1s of standing still before the spikes. 10 puts a hands-off death at 13.0s
while a brisk player still wins. 8 was tried and rejected — 11.4s, but an unhurried player loses
ten rounds in twelve, and in an ad the chest is the payoff.

Locked in by a new test, *"a wall that gives ground must not be abandoned by the pile"* — which
asserts the sim contract that actually broke rather than re-deriving `board2d`'s integrator.

A side effect worth knowing: `push` is now genuinely two-way, so the stamina ring visibly refills
when a drain gives him ground back. `_drawStamina` always claimed to do that and never could.

**The lesson, recorded because it cost real time:** a hunch written down in a plan document reads
like a finding six hours later. That paragraph in `PLAN.md` had been believed twice before anyone
executed it.

---

## The rig, in four files

The character arrived over four exports, and each one moved the work.

> the bug is fixed, the glb is done with animation. can you please check if it's alright
> [`character.glb`]

> I need you to focus on the character. The size we will oprimize later. please don't cofuse me.
> will character implementation work. did export happened correctly?

**What this produced.** A correction to my own framing. The first pass buried "does this load and
animate" under bundle-size analysis, which was not what was being asked and not what was blocking.
The answer that mattered was structural: it would load, and the clip contract `hero3d.js` was
written against did not match what was delivered.

> I prepared [`hero.glb`] for the character implementation, it uses this texture. anylize and
> let's create implementation plan. ask questions. I created 3 idle animations for the charcter
> stamina regress, first phase is 0 and then 1 and then 2. when the character get his stamona
> restored the phases move opposite

The three idles are authored, not downloaded — built by hand from Mixamo poses as three readings of
the same brace at three degrees of exhaustion. Worth stating because it is the fact the whole
integration turns on: a clip library has no entry for "the same man, more tired", so the ladder
exists only because someone posed it, and everything below follows from the phases being genuinely
distinct poses rather than samples along a continuum.

**What this produced.** The measurement pass in `PLAN.md` §3, and **the one real design change of
the integration.** `hero3d.js` had been built to run `brace_idle` and `strain` simultaneously and
cross-fade them by *weight*, on the argument that quantised feedback would ruin the loop. That
argument does not survive the delivered clips: adjacent phases differ by 122° and 103° at the upper
arm, and 0 → 2 by 161°. Holding a partial weight blend between poses that far apart puts the arm
through a meaningless midpoint. **These are states, not endpoints of a continuum**, so it became a
three-state machine with a cross-fade on transition.

Driven off `push` rather than `pressure` — the latter is the spiky low-passed contact force, and
stepping states on it would flicker. Driving the ring and the character off the same value also
guarantees they cannot disagree. Hysteresis, or it chatters on a hovering value: enter phase 1 at
0.35 and fall back at 0.28; enter phase 2 at 0.68, fall back at 0.60.

> it's not working( the character is in t pose. no animation skeleton works

**What this produced.** A T-pose with no console error is a specific signature: the mesh and the
skeleton loaded, the clips did not bind. Worth recording because the fix was upstream of the code —
the export, not the loader.

> I exported clean fbx [`hero.fbx`] file. can you convert it to glb or should I do it myself?

**What this produced.** A headless Blender conversion, and the finding that most of the first GLB
was dead: **79 of its 107 skeleton joints carried zero vertex weight** — the IK/FK control rig,
animated in full by all six clips — plus a 163 KB embedded PNG of an image already in the repo at
9 KB as WebP. Re-exported deform-only:

| | before | after |
| --- | --- | --- |
| File | 1,254,308 B | **631,692 B** |
| Skin joints | 107 (28 weighted) | 28 (28 weighted) |
| Nodes | 129 | 30 |
| Channels per clip | 321 | 87 |

Verified equivalent rather than merely smaller: identical mesh (9,395 tris), identical bind pose,
identical loop closure on all three idles and `push`, identical `rope` and `push` hip paths.

> Yes I put hero2 file to reimport the character

> okey, it worked now, but animation had artefact, so i updated the hero2 file, can you please
> reimport it

**What this produced.** `hero2.glb` — same skeleton, same six clips keyframe for keyframe, same
2.04u body, mesh cleaned up. Every measurement taken off the first rig still holds, which is why
the clip table in `PLAN.md` survived the swap unchanged.

### The standoff, and the hands in the stone

> Okay, blet's fix character position, it should be strictly align with the animation, right now it
> floats. we need the offset be more stricted, otherwis the characters hands go through the pillar
> and then come back

> the character should immediately mothe the offst of the idle_1 when it comes from idle_2. this is
> the most visible moment

**What this produced.** Two fixes, and one thing still open.

Each phase stands at its own distance from the pillar (`PHASE_OFFSET = [-8, 14, 36]`), and that
standoff was being eased with an exponential smooth — `_offset += (target - _offset) * dt /
PHASE_FADE`. That curve is only 64% of the way after `PHASE_FADE` and needs about 0.9s to arrive,
roughly **three times as long as the pose it was supposed to travel with**. So on the way *down* a
phase the pose became `idle_0`, whose arms reach furthest of the three, while the body was still
standing at phase 1's closer mark — hands into the pillar, then drawing back out as the offset
crept along behind them. Replaced with a linear ramp over exactly `PHASE_FADE`, which is what the
mixer does to the pose weights, so the two are at the same fraction on *every* frame between rather
than only at the ends.

The second is asymmetric on purpose. **The two directions are not the same problem.** Stepping down
he must move away from the pillar while fading into a pose that reaches further, so any ramp at all
puts his hands through stone — and it is the most watched moment in the round, because it is the
one the player earned. That one snaps. Stepping up, he is being driven onto the pillar and his
hands are drawing in; nothing can penetrate anything, so it rides the cross-fade, which is what
sells being pushed. The cost of the snap is the mirror of what it fixes — for a few frames his
hands are short of the stone — and that is the right way round: a man bracing slightly off the
pillar reads as a man bracing; a hand inside it reads as a bug.

> it's still looks bad( let's wrap up the things and then comback to it.

Still open. See **Still open** at the end of this file.

---

## Three agents in one working tree

The most transferable part of this stretch is not a feature. It is that the parallelism was *managed*
— the questions below were asked before the collision happened, not after it.

> the other agent is working on 3d part, the spikes are ready and other assets too, can i run any
> other agent and not desturb the work of the one who implements the hero rn?

> my hero agent work on game js as well. can we prevent the rope aagent from crossing the hero one?

**What this produced.** File ownership as an explicit brief, not a hope. `game.js` is the shared
surface every feature eventually touches, so the rule became: one agent owns it at a time, and the
others are told in their prompt which files they may not open. Twice the answer was simply "not
yet" —

> don't touch the game js yet

> don't change the game js file yet

— and the parked agent built its module in isolation until the seam was free. `rope.js` and
`dust.js` are both shaped by that: they are self-contained and take everything they need as
arguments, because they were written with no access to the file that would eventually call them.

The commit discipline came from the same place. No agent in this project runs `git add -A`, `git
commit -a`, `git checkout`, `git restore`, `git stash` or `git reset` — every commit stages explicit
paths, because a sweeping stage in a tree with three agents in it captures someone else's
half-finished work.

> I think the rope agent toke too make tokens to execute. how can we prevent this? I think the
> agent should ask confirmation for long processes

> this is too much. don't write expensive tools please, write it as a rule. Ask confirmation for
> token heavy decisions

**What this produced.** A standing rule, and it caught a real case later the same day — see
*the spikes* below, where an elaborate measurement harness was interrupted mid-build in favour of
changing one number.

---

## The rope, designed by rejection

> i want in the end of the gameplay when the debris are cleared add rope hanging from the top
> (outside the screen. the character is gonna be 3d. and has animation of hanging on the rope.
> what would be the best and easiest was to execute it ? it's just a discussion for now

> let's think before the execution. first I know that rope is usually done from many duplicated
> ovals. how we gonna reach the flexibility of the rope here? Also did you understand the logic of
> the rope? First it unfolds from top and momentum forces it to the hero hands and then it swings
> back. How should we do it?

> the rope look very bad and rigid it

> no, the swing happens and then the rope is chaotic. Is there maybe simplier solurion, some sort
> of hack?

**What this produced.** Two simulated versions thrown away and a closed-form one kept, which is the
whole design of `rope.js`.

A Verlet chain went first, then a chain of angular springs. The springs gave a lovely bow and then
*rang*; once the rope was also being pulled onto a moving hand every frame, the solver and the
correction fed each other and it went to noise. A three-second scripted beat has no use for a solver
that can surprise you.

So the bend is closed form. Every segment is offset from the driven angle in proportion to how fast
the rope is currently swinging — a first-order expansion of "sample the driven angle `f*LAG` seconds
ago". The rope trails its own motion, bowing against the direction of travel and most at the loose
end, and straightens as the swing decelerates, which is what a rope on a pendulum actually does at
the ends of its arc. Nothing accumulates between frames, so nothing can ring, drift, blow up, or
behave differently at 30fps than at 120 — measured, identical bow to within one unit across all
three. The swing itself is one `sine.inOut` tween, which is not an approximation of a pendulum: simple
harmonic motion between two extremes *is* a sine, so there is no gravity constant to reconcile with
the scale of the art. The knob is the duration.

> the rope is coming from the top behind the screen so player dosn't know where is the anchor, we
> can unfold it in the side from right left, so it will have the momentun to swing towards the hero.
> no dangle or complexcity, we need some simple solution cuz it's just the outro. and there is
> gonna be fade

**What this produced.** The beat, and it is the user's design rather than mine. The anchor sits 400
units above the document top — off-screen at every aspect ratio, since `Layout.edges.top` runs from
0 in portrait to ~280 in 16:9 landscape — so the player never sees where it is attached and never
asks.

> the rope dosen't touch the character at all. can you play and check yourself. the rope never
> swings back

> right now the unfolded rope is shorter than the one that character takes. is it possible to fix it?

**What this produced.** The aiming contract. Where his hands are is not something `rope.js` should
guess: his on-screen x is the braced position, plus the rig's phase standoff, plus however far the
pillar has shoved him — and all three have been retuned since. Reassembling them inside the rope
would go stale on the next tuning pass. So the caller hands in an `aim` that reports the rig's actual
hand bone, and from the grab onward the chain is rotated and stretched onto it. Safe to do every
frame precisely because there is no integrator: with no state, there is nothing for the correction
to disturb. The length mismatch was the same bug from the other end — two different lengths, one
scripted and one measured, and now only the measured one exists.

---

## The trap, in six pieces

> we need to reimport walls, ceiling and the spikes, and use the masks to animate it. can you fisrt
> check the design file to understand the logic

> I reexported it myself, I want you to understand the placements of the assets and the masks for
> each. for example i need the rectangular mask for the [ceiling] to move to reveal it from left to
> right. it should be right after the character lands. and spikes wall should render in layers

**What this produced.** The old extract had the trap as two flattened images, and that is exactly
why neither could move: `wall.png` baked the ceiling beam into the bars, and `spikes.png` was the
spike bank already masked down to its tips. Re-exported as six pieces — `top_walls`,
`top_walls_ceilling`, `spikes_body_back`, `spikes`, `spikes_body_top`, `spikes_mask` — the rods
became a sprite that can travel, and `spikes_mask` (the wall silhouette with the seven socket mouths
punched out) became an **inverse** alpha mask over them, so a rod emerging from its socket is
occluded by the wall it is emerging through.

> great! is it possible to render spikes infront of the character?

**What this produced.** The one layering trick in the scene. The rig draws on `#three-canvas`, which
sits above every Pixi layer, so nothing in Pixi can ever be in front of him — and spikes that stop
behind the character do not read as spikes reaching him. The lifted tips were moved onto *his*
canvas, because only his own layer can be in front of him.

> worked well. let's now fix last part of it. the tips now are abow the end screens. can we hide it?

Same cause, opposite symptom: living above Pixi means living above the end cards too. The tips are
struck explicitly when a card comes up, and on the fail card the spikes go home first, under the
fade — the crush is what killed him, so it does not stay on screen arguing about it.

> can we fix the spikes position the max one. it too short before it get's out. I need the player
> feel real danger from the spikes, can we push theit max position?

> chill out, there is a spikes max pos somewhere. you need to change just that number

**What this produced.** A correction to how I was working, and it was right. I had started a
headless measurement of the hero's posed silhouette against the rod tips — `Box3.setFromObject`
ignores skinning on a `SkinnedMesh`, so a real posed bound needs `applyBoneTransform` per vertex,
which is a genuinely interesting problem and completely beside the point. The answer was
`SPIKE_CREEP`, 10 → 30.

The one number worth keeping from the harness before it was deleted: the rods are 108.7 units long
starting at x 310.8 against a wall face at 400.2, and `SPIKE_SLAM` adds 45 on top of the creep. At
30 the rod's tail still sits 14 units behind the face; past about 40 it clears the wall during the
slam and a hole opens behind the spikes. So 30 is 3× the travel with headroom, and 40 is the ceiling.

---

## The badge under him

> let's work on stamina ui. i want it's placing below the character. i want it to move with the
> character. Stamina ui should appear only after the first move of the player

> great, can stamina phases (green yellow and red) be synced with animation changes of the hero
> (idle_0, idle_1, idle_2). and the progress bar of the stamina i want as color overlay on the cicle
> and hand

**What this produced.** A gauge built by **masking the shipped artwork** rather than redrawing it —
a Graphics pie wedge over the ring, a rising waterline up the arm. The radius, thickness and
antialiasing are then the artwork's own, where a Graphics approximation has to be remeasured against
every re-export. Both source layers are white, so the phase colour is an exact multiply.

The phase is read from the rig's `_phase` — the same state machine driving the pose — rather than
from a second set of thresholds on the same value. Two thresholds derived from one signal still
drift, because the fades differ; one source cannot.

Asked whether the ring should unwind or the arm should fill, the answer was **both**, and they run
off the same `1 - push`.

**A mistake worth recording.** I sized the badge by hand-waving "about 7 units of clearance" past
the board's first column, then wrote a simulation to check it, which reported *collides by 28*. The
simulation was wrong, not the badge: it swept drain rates up to 1e6/s, thousands of times faster
than the game can produce. `CREEP_SECONDS = 10` and `RELIEF_SECONDS = 6` cap `push` at 0.1/s up and
0.167/s down, and against those the true worst case is 2.6 units. Settled at `STAMINA_SCALE = 0.42`
for 10.8 units of clearance, plus a hard clamp that on the real numbers never fires. **A sweep whose
range the system cannot reach is not a safety margin, it is a false alarm** — and it very nearly
bought a much smaller badge than the design wanted.

---

## A sparkle that would not draw

> let's add particle in the corner of the gem the tutorial asks to move, like a hint for the player,
> don't sink it with hand or smth, it should be slow and random, just 1 particle in the corner with
> additive blend mode. scale and rotate.

> the shine should be on the left coner on the lightest part of the gem. it should appear randomly on
> both gems and add random shine on othe gems as well, but not frequent 2 gems max at once

> the other gems shoul also randomly shine, can you do it please

**What this produced.** The same complaint twice, and my first diagnosis was true but not the cause.
I reported the stray rate as too low — one every 7.3s — which was accurate and did not fix it. The
real fault was structural: both kinds of sparkle drew from **one pool of two sprites and one coin
flip**, so a stray had to win the toss *and* find a free slot, and every loss handed the beat back
to the hint pair. Rebuilt as two dedicated streams, each chain-scheduling its own successor off the
previous sparkle's death.

> the shine should scale with the gem, i think you should out it it the container of the gem. and i
> don't see the shine of other gems

> the shine overlay in corner of the gems dosen't work. investigate

**What this produced.** The most useful single finding of the stretch. Parenting the sparkle to its
gem was the obvious reading of "put it in the container of the gem", and it made the sparkle vanish
entirely.

**Pixi v8 sets `allowChildren = false` on `Sprite`, `Graphics`, `Mesh`, `Text`, `NineSliceSprite`,
`TilingSprite` and the base `ViewContainer`.** `addChild` on any of them takes a deprecation path —
*"Only Containers will be allowed to add children in v8.0.0"* — and the child never draws. It is a
warning, not an error, and in a build with a busy console it is easy to miss entirely.

So the sparkle follows its gem per frame instead of being parented to it, copying position and
scale. That forced a second change: `_followSparks` writes `scale` every tick, so a GSAP tween on
`sprite.scale` is undone on the next frame. The tween drives a scalar `st.k` which the follow then
multiplies by the gem's own scale — which is also what makes it scale *with* the gem, as asked.

---

## A CTA that opened nothing

> let's add link for the CTA download button and the open chest screen, [url] this should work for
> the whole win screen

> it didn't work. it redirected me 0 times, the link didn't open

**What this produced.** Two bugs stacked, and the first one hid the second.

`@smoud/playable-sdk` is a hard dependency, so `this.sdk` is never null, so `_cta()` always took the
`sdk.install()` branch and the `else window.open(...)` was unreachable code. Underneath that, the
SDK's own `destinationUrl` was the empty string — **it reads its entire configuration from bundler
defines**, not a runtime API. With `APP_STORE_URL` and `GOOGLE_PLAY_URL` undeclared, `initSDK`
evaluates them as undefined identifiers, `destinationUrl` stays `""`, and every branch of `install()`
ends at `window.open("")`. The CTA looked correctly wired and went nowhere.

Fixed with the defines in `vite.config.js`, the URL in one module (`src/cta.js`) that both the config
and the game import so they cannot disagree, and `window.open` moved *outside* the `try` so a
throwing SDK still lands somewhere. Verified in `dist/index.html` rather than in source: all four
identifiers substituted, `destinationUrl` a literal URL.

> worked, let's ad bounce for the buttons on the end screens

> can we fix the win card and fail card button bounce? it's not how the button should be animated,
> you can reuse cta button animation for end screens

**What this produced.** A rejected hop, replaced by the CTA's existing breath — and consolidating the
two revealed a standing bug. The pulse tweened to an *absolute* scale, so it overwrote the 0.9 that
`_anchorHud` sets for the landscape CTA, and yo-yoed back to whatever the scale had been when the
tween was created. The landscape CTA had never actually been 0.9. The shared pulse multiplies a
`base` instead.

---

## The panic beat

> let's add the red frame to warn the player on the last phase of stamina. and add this sound for
> last phase [`heartbeat.mp3`]

> can you make heart beat faster when the stamina goes down?

> let's remove the [`man_struggle.mp3`] from the last stage of stamina. it' too repetitive.

**What this produced.** The red frame and the heartbeat as **one timeline**, so they cannot drift
apart. The period is a property of the clip rather than a taste call, and it accelerates as the last
of his ground goes. The frame's envelope is fast in and slow out over the rest of the beat, because
a heartbeat is a hit — a frame that blinks off reads as a glitch, one that breathes reads as him.

The removal is the more interesting note. The last phase already had a voice, and stacking a struggle
grunt on top of a frame and a heartbeat made all three read as less. Cutting one made the other two
land.

---

## Sweeping the assets

> can you please anylize which assets are used in the code and delete the ones which are not used.
> preserve the png copies.

**What this produced.** An answer that was cheap only because of a decision made much earlier: the
bundle's asset surface is *fully enumerable*. `layers.js` names every layer with an explicit import,
`audio.js` every clip, and `art.js` has three narrow globs. Diff that against the folder and the
unused set falls out with nothing to infer. This is the payoff for the rule in `layers.js` — the
bundle is a function of what is used, not of what exists — and it would not have been answerable
against an `import.meta.glob` over the art folder.

24 files, ~8.6 MB: sixteen orphan `.webp` whose PNG sources stayed, three weights of Baloo2 against a
text pass that never happened (the codebase constructs no `PIXI.Text` at all — every word on screen
is baked art), the FBX the rig came from, the rig it superseded, and preview stills from earlier
chest and win-card explorations.

**And the half that mattered more:** `npm run art` walked `layers/` and wrote a `.webp` beside every
PNG in it, so the cleanup would have undone itself on the next art pass. It now iterates a
`LAYERS_SHIP` list, the way it already handled `vfx/`, verified 35-to-35 against `layers.js`. A
cleanup that a build script silently reverses is not a cleanup.

Nothing here changed `dist/`: none of it was ever imported. Repo weight, not ad weight — worth
saying, because "removed 8.6 MB" would otherwise read as a bundle result.

---

## Working rules this stretch produced

These are the author's, not mine — every one arrived as a correction, and every one was right. Taken
together they are a working method for running AI at scale on a production with a date on it, which
is a different skill from prompting well: it is about bounding what an agent is allowed to spend, and
on what.

1. **Ask for a preview; do not build a harness to look at it.** Measurement is mine, appearance is
   theirs. A verification harness was interrupted with *"it worked"*, then *"don't test"*, then
   *"from now ask me to preview"*. Numbers still get measured headlessly. Anything judged by eye gets
   built, handed over, and waited on.
2. **One number beats an investigation.** *"chill out, there is a spikes max pos somewhere. you need
   to change just that number."*
3. **Confirm before token-heavy work.** *"Ask confirmation for token heavy decisions"*, after an agent
   burned a session on the rope.
4. **No scratch files in the project tree.** *"don't create unnesessary text files"* — temporary work
   goes to the session scratchpad and is deleted after.
5. **One agent owns `game.js` at a time**, and the others are told so in their prompt.
6. **Stage explicit paths, never `-A`.** Three agents share this working tree.

---

## Still open

- **`walkthrough.mp4`** — the last deliverable. It records the finished playable, so it is last by
  definition.
- **The rig's standoff still reads as floating.** Two real fixes landed (above) and the verdict was
  *"it's still looks bad( let's wrap up the things and then comback to it."* Deferred deliberately,
  not forgotten. The next thing to try is per-clip offsets rather than per-phase: the standoff is
  currently one number for each of the three idles, and `push` — which plays whenever he is winning
  ground — borrows phase 0's.
- **Bundle optimisation**, in progress in a parallel session as this is written: the rig re-exported
  smaller again, and the endcard ray layers re-encoded at the lower alpha quality that `error`
  already used.
