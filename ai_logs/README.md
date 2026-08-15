# AI Logs

How Temple Escape was built with AI assistance.

| file | what's in it |
| ---- | ------------ |
| [`01-workflow.md`](01-workflow.md) | tools, how the work was split, how AI output was verified |
| [`02-build-log.md`](02-build-log.md) | what was built, the decisions behind it, what broke |
| [`03-prompts.md`](03-prompts.md) | the session's prompts, verbatim |

## Starting point

This build did not start from an empty directory. It was seeded from a **match-3 playable
template of our own** — pure match-3 rules, a granular debris simulation, their Pixi
renderers, and the headless test suite that covers both. That template was written for this
kind of creative and carried across deliberately; `02-build-log.md` lists exactly what came
over, what was left behind, and what was written fresh on top of it.

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
