# AI Logs

How Temple Escape was built with AI assistance.

| file | what's in it |
| ---- | ------------ |
| [`00-origins.md`](00-origins.md) | the seed project, and the 3D intro act that was designed, blocked out and cut |
| [`01-workflow.md`](01-workflow.md) | tools, how the work was split, how AI output was verified |
| [`02-build-log.md`](02-build-log.md) | what was built, the decisions behind it, what broke — through the rubble and PSD work |
| [`03-prompts.md`](03-prompts.md) | the prompts behind that stretch, verbatim |
| [`04-finishing.md`](04-finishing.md) | the rig, the outro, the trap and the round's UI — prompts and build notes together |

`02` and `03` split build notes from prompts; `04` merges them, because the later work came in
short feature-shaped sessions where the prompt, the decision and the bug are one beat. Where `04`
contradicts `02`, `04` is current — the character was still a painted placeholder and the outro
still ran him to a door when `02` was written.

## Starting point

This build did not start from an empty directory. It was seeded from a **match-3 playable of our
own** — pure match-3 rules, a granular debris simulation, their Pixi renderers, and the headless
test suite that covers both. That project was written for this kind of creative and carried across
deliberately; `02-build-log.md` lists exactly what came over and what was written fresh on top of
it.

The seed was **lightweight 3D**, and this one is not. It is also where the creative's first act
lives: an upper temple room, a chest lit by god rays, a hidden step, and the floor giving way —
blocked out with a marker-driven camera, then cut so the match-3 loop could be made to feel right.
The playable delivered here is the second half of that. [`00-origins.md`](00-origins.md) is the
full account, and it is the reason `assets/source/blender/world.blend` ships.

Earlier still, before this folder existed, there is [`../analysis/`](../analysis/README.md) — the
pre-production research the build was aimed at, including `PROMPT_LOG.md`, 48 prompts recovered from
Claude Code's `history.jsonl` after the raw June transcripts hit the 30-day cleanup.

## The short version

AI was used throughout — as a design interlocutor, for implementation, for concept and art
generation, for turning that concept into a 3D character, and as its own adversarial
reviewer. Every design decision, and the final compositing, is human. `01-workflow.md` has
the tool-by-tool breakdown and the full asset pipeline, from ChatGPT concept through Tripo3D
and Blender on the 3D side, and through Codex layer separation and Photoshop on the 2D side.

The pattern that produced the best results, and the one worth taking away:

**Separate the rules from the pixels, then test the rules with no browser in the room.**
`match3.js` and `debris_sim.js` are pure JavaScript — no Pixi, no Three, no DOM — so they run
under plain `node`. That means AI-written game logic gets checked by execution rather than by
reading, which is the only way several of the bugs in `02-build-log.md` were ever going to be
found. A rubble mass that has silently frozen into a dead heap still renders as a perfect
pile.
