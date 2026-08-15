# Assets

Everything in this folder is original — authored for this project or licensed for open use.
No asset from any shipped commercial title is present, in the repository or in the build.

```
assets/
├── art/
│   ├── layers/       the layout PSD, exported one layer per file, + manifest.json
│   ├── vfx/          particle and glow sprites
│   ├── 3d/           the character rig and its palette atlas
│   └── rock0*.png    four rubble tumble sheets
├── audio/            21 original clips, mp3
└── source/           authoring files — NOT shipped in the build
    ├── blender/      world.blend + its glTF export, and the export script
    └── textures/     full-resolution temple textures and their PSD
```

## The rule this folder runs on

**The bundle is a function of what is used, not of what exists.** Nothing here is discovered by
walking a directory. `playable/src/layers.js` imports each shipped layer by name, `audio.js` imports
each clip by name, and `art.js` uses three deliberately narrow `import.meta.glob` patterns. That is
what makes "which assets does the build actually contain" an answerable question rather than an
estimate — and it is why a wide glob was removed early: with `eager: true` it inlines everything it
matches whether or not anything reads the result.

Consequence worth knowing: **an art file dropped in here does nothing until something imports it.**
Adding a layer means adding a line to `layers.js` (and to `LAYERS_SHIP` in `tools/optimize-art.mjs`,
below).

## art/layers/ — the PSD extract

One PNG per layer, plus `manifest.json` recording each layer's box and opacity in document space.
The manifest is the single source of placement: document coordinates are never retyped in code, so
they cannot drift from the PSD.

The two are independent on purpose. `box(name)` returns placement with no art — used where one
texture serves two boxes, as the CTA does with the win card's button. `url(name)` returns art with
no placement, for anything positioned by code rather than by the document. `layer(name)` insists on
both and returns null if either is missing.

The extract holds every layer of the document; 35 of them ship. `manifest.json` still carries a few
entries whose art was deleted — harmless, since a lookup on one simply returns null, and the box is
occasionally still wanted after the pixels are gone.

**PNG is the source of truth; WebP is the shipped form.** `npm run art` transcodes one to the other:

```bash
npm run art
```

It works from explicit lists — `LAYERS_SHIP` and `VFX_SHIP` in `playable/tools/optimize-art.mjs` —
rather than walking the folders, for the same reason `layers.js` does. Keep `LAYERS_SHIP` in step
with `layers.js`: an import added there without a name here silently keeps serving a stale `.webp`.

Two deliberate exceptions, both measured rather than assumed. The sound-toggle icons and the confetti
scraps stay `.png`, because at 50×50 and ~1 KB the WebP container overhead makes them *bigger*
(1542 vs 1429 bytes, 1104 vs 1010). And `error` — the panic vignette — plus the three endcard ray
layers are encoded at a much lower alpha quality than the default 90, because each is a soft ramp
that *is* its alpha plane rather than a cut-out; the note in `optimize-art.mjs` has the numbers.

## art/3d/

`hero2.glb` is the character: one skinned mesh, 28 deform joints, six clips — `idle_0`, `idle_1`,
`idle_2`, `push`, `land`, `rope`. `texture_world.webp` is its palette atlas, shipped beside the GLB
rather than embedded in it: the same 512×512 image cost 163 KB as an embedded PNG against 9 KB here,
so the export writes no textures and `hero3d.js` assigns this one at load.

Because it is a palette — ~30 vertical colour strips across 512px — mipmaps are turned off on it.
At the size the hero renders, mip levels blend neighbouring strips and the colours go muddy.

The clip table and the rig's measurements are in `PLAN.md` §3.

## art/rock0*.png

Four tumble sheets, one per rock type, each a strip of square frames. `art.js` composes them at boot
into one atlas so the whole 200–400 rock mass batches into a single draw call. Atlas geometry is
owned by `playable/src/debris_sim.js` (`ROCK_FRAMES`, `ROCK_TYPES`) and imported by `art.js`, so the
sheets and the simulation cannot drift apart.

## audio/

21 clips, all wired: the music bed, six merge recordings that climb a rung per match, five stone
one-shots, the trap and door sounds, the heartbeat, and two vocal beats for the character. Every
file in this folder is imported by `audio.js` and no import lacks a file, so the folder and the bank
stay in sync.

They inline into the single-file build, which makes them the largest single block in it. The next
saving here is encoding rather than curation — mono at a lower bitrate, and trimming the long stone
tails.

## fonts — none

There is no `fonts/` folder, and the build loads no typeface. Every word on screen is baked art out
of the layout PSD (`MERGE_TO_SAVE_HIM`, `HURRY_UP`, `DOWNLOAD`, `OPEN`, `WIN`, `FAIL`, `TRY_AGAIN`),
and the codebase constructs no `PIXI.Text` at all. Three weights of Baloo2 used to sit here against a
text pass that never happened — ~2 MB of TTF for zero glyphs rendered.

If live text is ever needed, subset the weight to Latin + digits and convert to WOFF2 before
importing it: the full TTFs would be a large fraction of the bundle for a handful of characters.

## source/

Authoring files, kept for provenance and future edits. Nothing here is imported by the playable, so
none of it reaches `dist/`.

**`world.blend` is the intro that was cut**, and that is why it ships. It is the temple scene from
the project this one was seeded from: named marker empties for the camera and hero positions, a tile
grid matching the match-3 board, and collider meshes. The markers are the whole first act —

```
point_camera_start_0    front establishing shot, upper room
point_camera_0          the moment of falling
point_camera_1          gameplay cam, straight-on at the board
point_camera_target_1   authored look-at for the gameplay camera
hero_point_start_0/1    the walk, and the breakable-floor spot
hero_point_1            underground landing — where the delivered playable begins
point_fire_0/1/2        torch glow
```

— the explorer crossing an upper room toward a chest lit by god rays, stepping on a hidden stone,
and dropping through the floor into the chamber this playable takes place in. It is not a sketch: it
ran, on a marker-driven camera timeline. See [`../ai_logs/00-origins.md`](../ai_logs/00-origins.md)
for what it was and why it was cut.

Keep it. It is the record of the act that did not ship, and re-exporting it is the cheapest route
back to that intro.

`design.psd` — the layout document everything in `layers/` comes from — is **not** in the repository.
At 83 MB of churning binary it would add a full copy to history on every save, so it is gitignored
and backed up outside. The consequence to be aware of: `layers/` and its manifest are the only record
of the layout here, so a fresh clone can use the exported art but cannot re-export it from source.
