# 01 — Workflow

## Tools

| tool | used for |
| ---- | -------- |
| **Claude Code** (Opus, CLI) | the main working surface — design discussion, implementation, refactors, test authoring, build audits |
| **node** | running the headless logic tests |
| **Headless Chrome** | boot and layout verification of the built file |
| **ChatGPT** | concept art, character design, and the 2D game assets — generated and iterated |
| **Tripo3D** | image-to-3D: turning the character concept into a mesh |
| **Blender 4.5** | cleaning up and adjusting the generated mesh, scene authoring, glTF export |
| **Mixamo** | character animation clips, retargeted onto the explorer rig |
| **Codex** | separating the flat generated composition into discrete layers |
| **Photoshop** | final composition — the layers settled into the real layout by hand |

**Who made what.** AI wrote the code, the analysis and this documentation, generated the
concept and the 2D art, and produced the first pass of the character mesh. A person made
every design decision, corrected and composited the art, cleaned up the mesh, and recorded
the audio.

Nothing in the project is copyrighted third-party material — that constraint drove several
decisions, including throwing away a set of placeholder art late in the process (see
`02-build-log.md`).

## The asset pipeline

Worth writing out, because it is the part of this project where AI did the most and the
handoffs are where it got interesting.

```
  concept + character design        ChatGPT
              │
              ├──────────────► 3D:  Tripo3D (image → mesh)
              │                       │
              │                     Blender  (cleanup, adjust, export)
              │                       │
              │                     Mixamo   (animation clips)
              │
              └──────────────► 2D:  ChatGPT (game assets, iterated)
                                      │
                                    Codex    (flat image → separated layers)
                                      │
                                    Photoshop (settled into the real layout, by hand)
```

**The 3D branch.** Tripo3D turns the character concept image straight into a mesh, which
collapses what is normally the most expensive step in a solo project. What it produces is a
starting point, not an asset: topology and scale need work in Blender before anything can be
rigged against it. Animation is Mixamo — retargeted, not keyframed — which is why `strain` is
authored as an exaggerated `brace_idle` rather than sourced separately: same bone tracks
means the pressure crossfade is clean.

**The 2D branch, and the step that actually mattered.** Generated art arrives *flat* — one
image with the whole scene baked into it, which is useless for a game where the pillar has to
move independently of the wall behind it and the spikes have to draw in front of the
character. Codex did the separation: the flat composition split into `walls`, `plates`,
`door`, `pillar`, `character` and `spikes`, each as its own transparent PNG, plus a manifest
recording back-to-front z-order and each layer's placement bounds in the source canvas.

The foreground layers are *reconstructed* in the source style rather than cut out of it —
you cannot mask pixels that were never drawn because something was standing in front of them.
That is the whole reason the step is non-trivial, and why the output still gets settled into
the final layout manually in Photoshop rather than assembled programmatically.

**Where the hand-work is.** Every generated pass is a draft. The consistent failure mode is
drift — separate generations disagree about lighting direction, palette and perspective, and
layering them exposes it immediately. The manual Photoshop pass is what makes six independent
generations read as one room.

## How the work was split

Not "AI writes, human reviews". Closer to: **the human owns the design and the art, AI owns
the implementation, and both argue about the mechanic.**

The mechanic is the hard part of this genre, and it is where the argument was worth having —
the difference between a puzzle that *causes* the rescue and a puzzle that scores a hidden
meter is invisible in a screenshot and decides whether the ad works.

Two working rules, both worth recording:

- **One decision per turn.** A design question answered with six open questions attached
  stalls a person rather than helping them. The rule: ask one blocking question, attach a
  recommendation, park the rest in the plan document.
- **No dead code beside its replacement.** The code is read by other engineers, so superseded
  modules get deleted rather than commented out.

## How AI output was verified

Ranked by how much they actually caught:

1. **Headless logic tests (`npm test`).** The rules live in modules with no renderer
   dependency, so they run under plain `node` — 43 assertions across match-3 and the debris
   sim. This is where the real defects surfaced; see `02-build-log.md`.
2. **Isolated harnesses.** The debris simulation ran in a standalone page asserting draw-call
   count, `glError`, and rock counts through a drain before it went near the game.
3. **Reading the built file, not the dev server.** `vite-plugin-singlefile` produces a very
   different module graph from Vite's dev server, and a bug that only exists in the bundle is
   a bug that only exists in what ships. `dist/index.html` gets opened directly before
   anything is called done.
4. **Screenshots — with a caveat.** Headless capture at `--force-device-scale-factor=2`
   catches retina layout bugs invisible at dpr 1. It cannot verify animation:
   `requestAnimationFrame` barely advances under SwiftShader, so a long capture yields a
   handful of frames. Motion has to be checked in a real browser.

## What AI was deliberately not used for

- **Design decisions.** The mechanic, the threat, the loop and the win sequence are human
  calls. AI's useful contribution there was arguing about implementation cost, not choosing
  what to build.
- **Balance numbers.** Inflow rate, capacity and start fill are tuned by playing. What AI
  contributed was making them *derived* rather than independent, so they cannot be set to a
  combination that silently breaks the game — see `02-build-log.md`.
- **Final art judgement.** Generated 2D passes are a starting point, not an output. The
  failure mode is consistency: separate generations drift in lighting, palette and
  perspective, which reads as a broken scene once they are layered together. Every pass is
  composited and corrected by hand against the layout.
