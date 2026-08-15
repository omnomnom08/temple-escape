# 03 — Prompts

Verbatim, chronological. Typos included — this is the real trail, not a cleaned-up one.
Session-management noise (`continue`, `go`, `yes`, one-word turns) is omitted; everything that
moved the design or the code is here.

Covers the build through the rubble and PSD work, ending where [`02-build-log.md`](02-build-log.md)
does. The prompts from there on — the rig, the outro, the trap and the round's UI — are in
[`04-finishing.md`](04-finishing.md), interleaved with the build notes rather than split from them.
The ones from *before* this folder existed, including the decisions that made the project 2D and cut
its first act, are in [`00-origins.md`](00-origins.md).

---

## Setting up the delivery

> I thnk we should start new folder from skretch. [...] Create new folder for match-3 game
> [...]. Use the current playable as template. Copy anything that we need. In logs mention
> that we copied from excosting match-3 template we created or smth like that. The psd I will
> give you when you are done. Let's make it neat and clean. Write ai logs please for this
> whole session. Read the pdf with the assignement again to understand the structure of the
> new folder.

**What this produced.** The assignment was re-read rather than recalled, because the
deliverable layout is specified in it and it is not the layout the working directory had:

```
/playable          the Vite app
/assets            art, audio, fonts — a sibling of /playable, not a child
/ai_logs
/walkthrough.mp4
/README.md
```

One non-obvious consequence of `/assets` being a sibling: the Vite dev server has to be told
it may serve files from outside its root (`server.fs.allow: ['..']`). The production build
follows the imports regardless — this only affects `npm run dev`.

The match-3 template was copied in, the third-party placeholder art and the parked 3D module
were left out, and `art.js` was written to replace the placeholder loader. Full inventory in
`02-build-log.md`.

> You are doing too much. We are going logs only for today

> like if we started task today

> cuz what we build is wrong

**What this produced.** The logs had been drafted as a multi-month archaeology of an earlier
build. Rewritten to what they are now: this project, this session, with the template
carry-over stated plainly and the superseded work left out of the narrative rather than
recounted in it.

---

## Pinning the loop

> here's the loop match3 tiles while debris rocks are falling on it → yellow pillar moves and
> saves the character from being pushed to spikes → the way gets cleared from debris and
> tiles, the rope appeares from the top → door opens → the character jums on the rope towards
> the door → end card

**What this produced.** The win had been modelled as a *state* — drain the mass, show a
result overlay. This reframed it as a *sequence*, which is what the brief's "what success
looks like" actually asks for. Two clips were added to the rig contract (`jump`, `swing`)
because the outro has the character traverse, which the earlier list didn't account for.

> we don't remove tile on the win state

**What this produced.** A correction, and a good one. The plan had the leftover blocks
crumbling away as the outro's first beat. But the path was cleared *by playing* — the holes
the player opened are why the rubble drained — so sweeping the remainder away in an animation
takes credit for work the player already did. Nothing is removed at the win; the final board
is a record of how they solved it.

## Checking against the brief

> please make sure if we are doing everything accoding to the asiignment

**What this produced.** A line-by-line audit with the technical claims actually executed
rather than assumed — dev server hit over HTTP, Node version checked, bundle grepped for
third-party residue and external URLs. It found three real defects: a competitor named in a
shipped source comment pointing at a document that didn't exist in this folder, a bare
`https://example.com` CTA buried in a function, and "plate" still used in code where the
design says "pillar". All fixed.

It also produced the more useful finding: the deliverable structure and documentation were
compliant, but four gameplay requirements were logic-complete and *not visually delivered*,
and "the player should understand within the first few seconds" failed outright — there was
no character in peril on screen, because the art didn't exist yet.

> I am in the process of the psd. do you think we can complete the task today? how much time
> do you think we need to complete everything from the pdf

**What this produced.** An honest estimate — ~13–17 hours of remaining engineering, plus 4–8
hours of character rigging that sits on the critical path twice. The answer was no, not
today. Presented with the option to cut the 3D rig for a 2D layered hero and hit the original
date, the call was to keep the rig and let the deadline move.

The estimate changed the work order: the rig loader was written *first*, against a
placeholder, so the rig's arrival became a file drop rather than an integration.

## Assets

> I know how to build assets for you correctly. don't worry. The character is ready too. I
> will use mixamo animations. If it looks bad i will switch to 2d spritesheets. But it will be
> costly for the size of the playable. Most of 2d work I leverage to chatGPT.

**What this produced.** Two things. Mixamo-specific export guidance — strip the finger bones
(~30 of ~65, roughly half the animation payload), In Place for every clip since world position
is driven by game state, one GLB with all seven actions rather than seven FBX files, and
author `strain` by exaggerating `brace_idle` so the bone tracks match and the weight crossfade
stays clean.

And a **correction to these logs**, which had claimed art and audio were hand-authored. That
was no longer true. The brief encourages AI use, so accuracy here reads as a strength rather
than an admission — but an inaccurate log is worse than whatever it was papering over.

It also produced a measured number that refined an earlier claim of mine: Three.js plus
GLTFLoader is a fixed **151 KB gzip**, so the 3D-versus-spritesheet margin is ~2.5×, not the
4–5× originally quoted.

> add into ai logs that the concept and character were created in chatgpt, 3d model ws created
> in tripo3d, and adjusted in blender. the 2d game assets were created and tweaked with
> chatgpt, the layarin was done with codex [...] and settled manually in psd

**What this produced.** The asset pipeline section in `01-workflow.md`.

## The PSD

> go through [...] design.psd and other assets in [...]

**What this produced.** The measurements that set the board spec — and a correction. I had
been repeating that a no-refill board starves at five colours. Measured properly across 200
seeded runs, the gap between three and five colours is about five percentage points, and the
win condition makes stranded tiles harmless regardless. The real lever is grid size: 5×6
gives ~7 moves before lockup where 6×8 gives ~11.6.

> can yoe export layers yourself. we will optimize to webp later

**What this produced.** The dependency-free PSD extractor described in `02-build-log.md`.

> I placed these items off screen cuz they are common for vertical and horisontal placement.
> that's why bg is square sized

**What this produced.** The layout model, and the clearest example in this project of why asking
beats assuming.

**The PSD was not a mockup, it was a responsive layout system, and it had been authored as one
before any of this code existed.** The square canvas means the backdrop cover-scales correctly for
portrait *and* landscape from a single document. The HUD sits off-frame because it is shared between
orientations and anchored at runtime, so there is no second set of positions to keep in sync. Both
of those are the answer to a problem the code had not yet reached.

Recorded because I got it wrong first: both looked like errors, and I had a question drafted
offering to "fix" them. One sentence took landscape support from unplanned to in scope — not because
anything was built for it, but because the art already had been. The lesson for me was to ask before
correcting an author's file; the lesson worth taking from the file itself is that a layout authored
against the *runtime's* constraints rather than against a single screenshot pays for itself the
first time the aspect ratio changes.

> yes. the geometry and placing is gonna be same as was in 3d. with changes as spikes and plate. I
> will create photoshop file with all placements and assets

**What this produced.** A dimension change that cost an art re-author instead of a scene re-derivation.
Moving the puzzle from 3D to 2D normally means re-establishing every position from scratch; locking
the geometry to what the 3D scene already had meant the layout was *carried*, which is why the
painted chamber still reads as the same room the 3D camera framed. See `00-origins.md` for the
decision it came from.

> don't forget to track ai logs

**What this produced.** This section, and a habit of updating these files as work lands rather
than reconstructing them at the end — which is the failure mode that lost the June session
transcripts in the first place.

## Wrapping up

> okay, go on. today is the day 3. so we need to wrap up everything today

**What this produced.** The whole build-out in one pass: the orientation-aware layout, the
scene composed from the manifest, the pillar wired to pressure, the board on its painted
recess with non-square cells, match chips, audio, the win escape, and both end cards.

Working this way — building a lot at once and screenshotting the result — is what surfaced
the three bugs in `02-build-log.md`. None of them were visible by reading the code. The
landscape HUD collision, the doubled rock atlas, and the megabytes of unreferenced assets all
announced themselves the moment something was rendered or measured.

> i will do optimizing manually later. I want to test build first

**What this produced.** The imports stayed on PNG for that build. What the build then showed
was that compression was not the problem: two over-broad `import.meta.glob` calls were pulling
assets nothing referenced into the bundle, which no amount of manual re-encoding would have
fixed. Narrowing them was worth more than every compression step combined — 5.0 MB gzip down
to 855 KB.

> the debris work very bad. They should stop fall when the way is cleared. the physics of
> debris is also bad. the dissapear from the middle and some of the just are left floating in
> the air. the debris should not cross the walls there should be a collider or smth like this.
> please investigate the debris

**What this produced.** The most productive report of the project, and worth noting why: it
described four *symptoms* rather than proposing a fix. Each one turned out to be a separate
bug with a separate cause, and the phrasing pointed almost directly at each — "disappear from
the middle" was the pool recycling live rocks, "floating in the air" was sleepers the
avalanche walk could not see, "cross the walls" was the absence of any lateral bound at all,
and "should stop when the way is cleared" was an inflow that never ended.

Two of the four were invisible to playtesting on their own and only fell out of measuring:
the round could be neither won nor lost, because a no-refill board permanently strands ~11% of
the rubble on blocks that never clear, while capacity was set so high that pressure peaked at
0.77. Full write-up in `02-build-log.md`.

It also caused a wrong fix to be caught by the tests rather than shipped — removing the
upward-stacking step to stop rocks floating collapsed the pile from 111px deep to 38px, which
a screenshot would probably not have made obvious.

> can you play it yourself and investigate? the debris fall in the first second and placed flat
> on the tiles, and next second get repositioned one on antoher. the gaps between debris are
> too big. [...] We critically need to polish it. cuz it's the main satisfying factor

**What this produced.** The rubble rewrite in `02-build-log.md`, and a change in method that
should have come much earlier. "Play it yourself" was not possible in the usual sense —
headless capture cannot show motion, because rAF barely advances under software GL, so every
screenshot is an early frame. So the sim was driven headlessly and its rock positions rendered
directly to a PNG. The lattice was obvious in the first image.

That harness is what turned a feel complaint into arithmetic: the rock art fills 80% of its
frame, diagonal neighbours sit packCell×√2 apart, and the difference was a 15px hole between
every diagonal pair. No amount of physics tuning would have closed it.

> take this playable as reference. Extract the debris logic [...].har from here

**What this produced.** An answer with a boundary. The HAR holds one 4.1 MB HTML file: compressed
asset bundles plus a readable config block. The config was extracted and it confirms the tuning
already in use — spin and angle rates, flow-audio gating, rock palette, type weights, all
matching. The actual collision and settling code is inside the compiled bundles, and lifting it
would mean shipping another studio's code in a brief that prohibits precisely that. Reference
analysis of technique and constants is what the brief invites; transplanting an implementation
is not, and it is the same line that got the placeholder art removed earlier.

> it feels too light, maybe you can inject logic of debris from here [another playable]

**What this produced.** A declined transplant and a found regression.

The reference is an existing engine with a working granular-debris implementation. This project
was built from scratch rather than on top of an existing engine precisely so the result stands
as original work, so lifting an implementation at the last minute would undo the reason for
that choice. Flagged in a sentence, not laboured.

It also turned out not to be needed. "Feels too light" traced to a single constant doing two
jobs: terminal velocity was derived from the pack grid as an anti-tunnelling guard, so
tightening the packing to close the visual gaps had quietly cut max fall speed by 25%. Fixing
it meant substepping the movement so tunnelling is handled by splitting the motion rather than
capping it — after which fall speed is a physical choice again, and the weight cues (gravity,
terminal velocity, near-zero bounce, screen shake on flow) could be set deliberately.

Worth recording as a pattern: two of the last three feel complaints were regressions from the
previous fix, and both were found by measuring rather than by reading the code.

---

## Judgement calls made without asking

Recorded because unflagged assumptions are how a restructure quietly loses something.

1. **The folder is named for an original setting.** The brief prohibits copyrighted assets.
   The requested theme is an adventure-archaeology archetype — a genre, which is fine — but
   naming a deliverable after the licensed property it resembles is not. Same look and feel,
   original name, no trademarked reference anywhere in the build.
2. **Kept `three` as a dependency and `#three-canvas` in the DOM** despite nothing importing
   Three at the time. The character is a rigged glTF, so this is a reserved seam, not leftovers.
   *Since resolved:* the rig landed and both are now load-bearing — the canvas is also what puts
   the spike tips in front of him. See `04-finishing.md`.
3. **Left `walkthrough.mp4` unmade.** It records the finished playable, so it is the last
   deliverable, not this one. *Still true.*
