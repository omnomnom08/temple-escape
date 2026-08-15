# Analysis — pre-production research

The assignment came with four reference creatives and a quality bar: the playable should read as
well as the modern rescue-ad benchmark it named, and should not copy it. That is a research problem
before it is a build problem — you cannot deliberately match a bar you have not measured, and you
cannot deliberately differ from something you have only glanced at.

This folder is that measurement.

**Two sources, and they are not the same kind of material.**

1. **The four reference videos supplied with the assignment.** Taken apart frame by frame — 481
   stills at 2 fps via ffmpeg — and distilled into the design DNA the build was aimed at. This is
   the homework the brief set.
2. **A shipped creative from the same genre, obtained separately.** Own initiative, and held to a stricter
   line: its live tuning configuration was read for technique and numbers, nothing else.

---

## A note on names

The title and publisher behind the reference creatives are **deliberately not named** in this
folder. `[TITLE]` where it appears is a redaction, not a broken placeholder.

They are commercial products belonging to other people, and naming them adds nothing to the
analysis: every finding below is about *technique* — asset budgets, tint pipelines, audio gating,
module structure — and technique is not anyone's trademark. The documents keep the file paths,
parameter names and measurements, because those are what made the research useful. The branding is
what was stripped, in the documents for the same reason it was stripped from the build.

## The line, stated once

**What was taken: technique, structure, and numbers. What was not taken: assets, code, or
branding.**

Nothing from any commercial creative is present in this delivery, in source or in the built file.
During tuning, placeholder art from a shipped creative was used so gameplay could be balanced
against reference-quality visuals — it reached 19% of the bundle and **all of it was removed**.
`ai_logs/02-build-log.md` records that removal.

The same line was drawn twice more, and both times the answer was no:

- A HAR capture of the competitor's creative was offered as a source of debris logic. The readable
  part is a configuration block, and that is what was taken. The collision and settling code sits
  inside compiled bundles, and lifting it would mean shipping another studio's code in a brief that
  prohibits exactly that.
- Later, a second existing engine was offered wholesale. Declined for the same reason, and it turned
  out not to be needed — the "feels too light" complaint traced to a single constant doing two jobs.

**Not shipped with this folder:** the 481 extracted video frames (`analysis/frames/`) and the
art-direction still. The documents below reference them by path and those paths will not resolve
here — deliberately. They are frames of commercial creatives, and a delivery for a brief that
prohibits copyrighted assets is not the place for several thousand of them, however they were
obtained. The written analysis is the work; the frames were the input, and the input stays where it
came from.

---

## Start here

| file | what's in it |
| ---- | ------------ |
| [`REFERENCE_ANALYSIS.md`](REFERENCE_ANALYSIS.md) | the design DNA — what the four references have in common, and what makes them readable in three seconds |
| [`SHIPPED_CREATIVE_CONFIG.md`](SHIPPED_CREATIVE_CONFIG.md) | a shipped creative's live tuning configuration, extracted and read: debris parameters, audio gating, palettes |
| [`SHIPPED_CREATIVE_TEARDOWN.md`](SHIPPED_CREATIVE_TEARDOWN.md) | how an ad of that quality is actually built — asset budgets, the greyscale-and-tint pipeline, module structure |
| [`per-video/ref-1..4.md`](per-video/) | the raw per-video breakdowns the DNA doc is distilled from |
| [`WORK_LOG.md`](WORK_LOG.md) | method: ffmpeg frame extraction at 2 fps, and how the analysis was actually run |

## Design evolution — superseded, kept for the trail

These record directions that were taken and then abandoned. They contradict the shipped game in
places, and that is the point: they are where the design was argued out.

| file | what it was |
| ---- | ----------- |
| [`CORE_MECHANIC.md`](CORE_MECHANIC.md) | "2D match grid drives 3D colliders" — the principle that survived, in its original 3D form |
| [`GAME_DESIGN.md`](GAME_DESIGN.md) | the locked setting and creative spec. Hazard was **rising lava** at this point |
| [`BUILD_PLAN.md`](BUILD_PLAN.md) | the first execution roadmap and asset shopping list |
| [`GAME_PLAN_V3.md`](GAME_PLAN_V3.md) | the 2D-puzzle / 3D-intro plan, written as the dimension change was decided |
| [`REBUILD_PLAN.md`](REBUILD_PLAN.md) | the four-day run to delivery, and the diagnosis of why the first version felt wrong |
| [`PROMPT_LOG.md`](PROMPT_LOG.md) | 48 prompts across 7 sessions, recovered from Claude Code's `history.jsonl` after the raw transcripts were auto-deleted at 30 days |

`PROMPT_LOG.md` is worth a note. When the June session transcripts expired, the decision trail for
that stretch would have gone with them; `history.jsonl` is not subject to the same cleanup, so the
user-side prompts were recovered from it. The equivalent trail for the rest of the project is in
[`../ai_logs/`](../ai_logs/README.md).

---

## What the research actually changed

The value of a teardown is only what it alters. Every row below is a finding from this folder that
is visible in the delivered playable.

| finding | what shipped |
| --- | --- |
| Their debris runs on `CustomPhysicsController` — a hand-written solver, not a physics engine | `cannon-es` was prototyped and dropped. `debris_sim.js` is a hand-written granular sim on an occupancy grid, with no physics dependency in the bundle |
| Rocks are 4 types × 13 frames of a looping tumble, authored greyscale and tinted at runtime, 85 KB total | four tumble sheets composed at boot into one atlas so the whole 200–400 rock mass batches into **one draw call** |
| Landslide audio is one rolling-mass recording, gated on how much mass is moving rather than per impact | the rubble rumble is a held loop whose gain follows *flow* — not a one-shot per collision that machine-guns or needs throttling |
| **Six** variants of the match-clear SFX, round-robined so the most-repeated sound never fatigues | six merge recordings — and taken further, as a **ladder** that climbs a rung per match and drops back after a couple of seconds without one, so sustaining a combo is audible |
| The big display words are pre-rendered images, not live font rendering | every word on screen is baked art from the layout PSD. The codebase constructs no `PIXI.Text` at all, and ships no typeface |
| One white particle atlas, tinted at runtime, covers the entire FX vocabulary | the stamina ring and arm are white art tinted per phase, so the gauge colour is an exact multiply; the sparkle is one additive primitive reused everywhere |
| The gameplay character is **one** rigged GLB, one baked texture, four clips — do not over-spec the hero | one skinned mesh, 28 deform joints, one palette atlas, six clips. The spec ceiling was treated as a budget and met |
| They ship Congrats, Fail and End as three separate card modules | simplified deliberately to one overlay with swapped content — declared as a simplification in the root README rather than left as a gap |
| Every reference uses an advancing snake as the time-pressure device | **rejected.** The threat is a physical mass the player's matches drain, so the puzzle causes the rescue instead of scoring it. This is the one place the research was used to decide what *not* to do |

That last row is the reason the rest of this folder exists. Studying four ads closely enough to see
that they all solve time pressure the same way is what made it possible to solve it differently on
purpose, rather than by accident or by omission.
