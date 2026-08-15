# 00 — Origins: the seed project, and the intro that isn't here

This delivery did not start from an empty directory, and `ai_logs/README.md` says so. This file is
the rest of that sentence: what the seed project was, what it had that this one does not, and why.

Earlier than everything here is [`../analysis/`](../analysis/README.md) — the reference research the
whole project was aimed at, and `PROMPT_LOG.md` in it carries the prompt trail from before this log
starts.

It is worth reading before the rest of the logs because it explains the single largest gap between
what Temple Escape was designed to be and what it delivers. **The playable in this folder is the
second half of a two-part creative.** The first half was designed, blocked out in 3D, and cut.

---

## What the seed was

A match-3 rescue playable built as **lightweight 3D**: an authored temple scene from Blender, a
perspective camera moved by named marker empties baked into the GLB, and the match-3 board and
debris simulation running inside it.

What crossed into this project:

| carried over | left behind |
| --- | --- |
| `match3.js` — the pure rules | `scene3d.js` — the 3D scene and its camera work |
| `debris_sim.js` — the granular rubble | `world.glb` — the authored temple |
| their Pixi renderers | the third-party placeholder art |
| the headless test suite | the perspective camera entirely |

The rules and the rubble were the expensive parts and they were written renderer-agnostic from the
start, which is exactly why they survived a change of dimension without being touched. That is not
luck — it is the same separation that makes them testable under plain `node`, and it paid for
itself twice.

---

## The intro that was designed

The creative was two acts. Only the second one ships.

> so I am gonna add spikes as the thread from left side of the canvas. The character (2d or 3d)
> gonna push the plate (like in the refs). the debris gonna push the plate on the character. **the
> scene intro gonna be 3d. i'll make it scenic, so the main character almost touches the chest and
> then falls, like in cartoons.** the whole pusle scene gonna be 2d.

The full beat, as authored:

1. The explorer enters an upper temple room. A chest sits at the far end, lit by god rays.
2. He crosses toward it — the payoff is *right there*, and the player watches him nearly reach it.
3. He steps on a hidden stone step. It triggers.
4. The floor gives way beneath him and he drops into the temple's underground.
5. **The playable in this folder starts here.**

That is a genuinely better opening than what ships, and not by a small margin. The delivered intro —
a camera that opens tight on him and pulls back as he lands — is a compressed stand-in for it,
deliberately built to be readable in about a second because it had to do the same job in a tenth of
the time.

### Why a fall, specifically

This was not a scenic choice. It is a hook I have watched work, from experience shipping creatives —
the falling-from-height openings that went viral in this category a few years ago were not popular
because falling looks nice. They are load-bearing, and for five separate reasons.

**A fall survives the first frame.** An ad has to work while it is being scrolled past. Falling is
the most legible motion there is: direction, speed and consequence read instantly, with no context,
at any size, with the sound off. Almost nothing else parses that fast.

**It is involuntary attention.** Falling is a primal threat signal. The viewer looks *before* they
decide whether they are interested, which is the only moment an ad genuinely gets for free.

**It answers "why is he here" with no exposition.** No text, no voiceover, no setup. He didn't
choose to be down there — the floor gave way. One event removes every question the player would
otherwise need explaining, in a format with no budget for explaining anything.

**It manufactures a victim.** The rescue genre needs someone who cannot save themselves, and that is
a real constraint: a character who *walked in* could presumably walk out, and the player's help is
optional. A character who fell is helpless by construction, so the puzzle is the only way out. The
whole premise rests on this and the fall is the cheapest way to establish it.

**It sets up loss aversion, and the win card pays it off.** He nearly reaches the chest and then
loses it. The references all use loss aversion the other way round — a scripted FAIL just before
escape — but showing the prize and *taking it away* does the same work at the front of the ad
instead of the back, and it leaves something concrete to win back. That is why the chest under god
rays is the win card: the two acts are the same shot at either end, and the ending reads as
restitution rather than as a generic reward.

### What survived the cut: the three seconds

The act went; the principle behind it did not. **The opening three seconds are budgeted the same way
whether or not the temple room exists** — active from frame one, no static title card, no logo hold,
nothing to wait through, and one piece of information per beat in the order the player needs it:
who → where → what is wrong → what to do.

So the delivered intro is the same argument compressed by an order of magnitude. The camera opens
tight at 2× on a man already falling and pulls back as he lands; the ceiling seals behind him; the
rubble arrives; the hand points. He still falls in — that beat was never negotiable, for the
"manufactures a victim" reason above — it just no longer has a room above it to fall *from*. The
root `README.md` has the beat-by-beat table.

What is genuinely lost is the reach-and-lose: without the chest at the front, the win card is a
reward rather than restitution. That is the part staging cannot substitute for, and it is why the
first act is high on the more-time list rather than a nice-to-have.

The other loss is duration. The drop is **half a second**, and a hook this dependent on the fall
should be given longer to land. Lengthening it is not a tuning change: he starts one body height
above the document top and the backdrop *is* the document, so there is no painted shaft above the
ceiling to fall through, and `T_FALL` is pinned to 0.50s because that is where the `land` clip
plants its feet. New backdrop art plus a loopable mid-air clip — which is the same art conversation
as restoring the act itself, and the reason both are listed together rather than separately.

### It is blocked out, not imagined

The seed project has it working. `scene3d.js` drives everything off empties baked into the scene:

```
INTRO  point_camera_start_0   front establishing shot
FALL   point_camera_0         the moment of falling
GAME   point_camera_1         gameplay cam, straight-on at the board
       point_camera_target_1  authored look-at for the gameplay camera
       hero_point_start_0/1   upper-room walk, and the breakable-floor spot
       hero_point_1           underground landing — where gameplay begins
       point_fire_0/1/2       torch glow
```

…and `playIntro()` runs the three beats as one GSAP timeline: walk to the breakable floor with the
camera tracking him, the floor break, then the fall on a gravity ease while the camera whips to the
gameplay framing. The seam between acts is inside the fall, which is the right place for it — the
player is looking at the character, not at the room.

**`world.blend` ships in this delivery for exactly this reason.** It is not a leftover and it is not
there for the rig; it is the record of the act that was cut, and the reason it is possible to say
"with more time, this" rather than "with more time, something".

---

## Why it was cut

Three decisions, in order, and none of them was about the intro.

**First, the whole puzzle went 2D.**

> I realized that competitor is using 2d for the whole match 3 scene. I think w should rebuild ours
> as well. Even in the task they asked to use only lightweighted 3d. So I think we should keep the
> intro 3d, but when the character falls in to the hole we should switch to 2d scene.

Note what this decision preserved: the intro stays 3D, the gameplay becomes 2D, and the *fall* is
the transition between them. The two-act structure was not a casualty here — it was the reason the
split worked.

**Second, geometry was locked so the change cost nothing.**

> yes. the geometry and placing is gonna be same as was in 3d. with changes as spikes and plate. I
> will create photoshop file with all placements and assets.

That PSD is `design.psd`, and it is why the 2D chamber reads as the same room the 3D one framed:
the layout was carried across rather than redrawn.

**Third — and this is the one that actually cut it — the loop was worth more than the opening.**

> Right now we need to comment the whole 3d intro. We need to make clear 2d scene first. the
> character will fall from top to it's place fir 1 sec or less (kind of part of the intro which we
> gonna work on later). and then the match-3 with debris as it is. **I want to focus on match-3
> satisfying gameplay rn** and later we will focus on intro (2d and 3d).

`scene3d.js` was commented out of the build the same day, with a note on it that it was parked
rather than dead. Three.js left the bundle with it — 151 KB gzip for a scene nothing imported — and
only came back much later, for the character.

**This was the right call and the logs should say so plainly.** A playable ad with a beautiful
opening and an unsatisfying loop fails; the reverse merely underperforms. The rubble is the thing
the player's hands are on for the whole round, and it took three separate investigations to make it
feel like mass rather than like sprites — all of them in `02-build-log.md`, none of which would have
happened if that time had gone into an establishing shot.

The cost is real and worth naming rather than hiding: the delivered creative starts *in medias res*,
underground, with no answer to "why is he here". It is carried by staging instead — the geometry of
the screen states the danger — and that works, but it is the compressed version of something better.

---

## Where the chest went

Worth recording, because it is the one piece of the cut act that survived.

The image the intro was built around — a chest, lit by god rays, just out of reach — is the win
card. `chest_closed` under `ui_endcard_ray` and two broad glows, one of them composited additively
because the PSD has it on linear dodge. The thing he was reaching for at the start became the thing
he gets at the end.

That is a better placement for it than the original, and it was not planned: the win card was built
long after the intro was parked, from the same PSD, because the chest was the obvious reward image.
The two acts turned out to be the same shot at either end of the round.

---

## The rest of the seed's trail

Prompts from the seed project that shaped what this one inherited.

> I want to polish gameplay rn and not to be distracted on generated images flaws. [...] The main
> problem that I am working on right now is the time pressure setting. Cuz both refs and compettitor
> were using snake. I an trying to invent something diferent and stand out with original idea. This
> snake thing is over used already

**What this produced.** The mechanic the whole creative is built on, and it is the decision that
most separates this from the references it was benchmarked against.

Every reference and the competitor use the same time-pressure device: an advancing snake, i.e. a
timer wearing a costume. Rejecting it forced a harder question — *what threat can the player's own
matches physically act on?* — and the answer is the one that makes the loop causal. The rubble is
both the danger and the meter, so clearing tiles does not increment a hidden score, it removes the
thing that is killing him.

Worth being explicit about the cost, because it was paid: a snake is trivial to build and impossible
to get wrong, and the granular mass took three separate investigations to make it feel like mass.
The originality was not free, and it was chosen anyway, in a brief that explicitly permits copying
the references.

> I recently checked other playables with the same set up and for optimisation they used 2d sprites
> for the debris. They made 4-5 images of the rock debris and were changing the image depending on
> the debris speed. I think it's very smart solution for playable perfomance.

**What this produced.** The rubble renderer this project still uses. Rocks are sprites picking a
tumble frame by speed — cheap motion blur — all sharing one texture so the whole mass batches into a
single draw call. It predates the 2D decision by four days and is the reason that decision was cheap:
the debris was already 2D in everything but the camera projecting it.

> right no the is problem with debris. when they hit each other. they remain still. this is very
> different from realistic movement from the competitor playable. and the reference videos. what can
> we do to give it more realistic behavior?

**What this produced.** The first of the three rubble investigations, and the beginning of a pattern
that ran through the whole project: every complaint about *feel* turned out to have an arithmetic
cause, and none of them were found by reading the code. Full write-ups in `02-build-log.md`.

> can you please open local host for me in browser with current playable?

> works. I added camera_target_1 for point_camera_1 so It's easier for you to adjust it. Can you
> please fix the camera?

**What this produced.** `point_camera_target_1`, listed in the marker table above — and a working
habit worth recording. The fix for a badly-framed camera was not a number in code; it was a new
empty in the .blend. The scene owns its own framing, the code reads it, and adjusting the shot never
requires touching either the loader or a magic constant. `hero3d.js` inherits the same principle in
this project: placement comes from `Layout`, never from a literal.

> you are overwhealming me with too many quastion at once. Can we do step by step descisions and
> solutions?

**What this produced.** The **one decision per turn** rule in `01-workflow.md`. A design question
answered with six open questions attached stalls a person rather than helping them; the rule became
ask one blocking question, attach a recommendation, park the rest in the plan document. Everything
in `PLAN.md` is downstream of this.

---

## Recording the cut act

The seed project still runs and `playIntro()` still works, so the blocked-out intro can be captured
as reference footage and shipped alongside `walkthrough.mp4`.

Two caveats before anyone tries it:

- **`scene3d.js` is not imported.** Re-enabling means importing it in the seed's `main.js` again.
- **`world.glb` may be stale.** `world.blend` was re-saved after the last export, so the GLB in the
  seed is not necessarily what the .blend now contains. Re-export before recording, or the footage
  will not match the file kept here as the reference.

It is worth doing. A ten-second clip of the upper room, the step and the fall shows the intended
creative in a way no paragraph in this file can, and it is honest about what shipped: the second
half of it, finished, and the first half blocked out.
