# Assets

Everything in this folder is original — authored for this project or licensed for open use.
No asset from any shipped commercial title is present, in the repository or in the build.

```
assets/
├── art/          runtime art the playable imports (see playable/src/art.js)
│   └── vfx/      particle and glow sprites
├── audio/        23 original SFX, mp3
├── fonts/        Baloo2 (SIL Open Font License 1.1)
└── source/       authoring files — NOT shipped in the build
    ├── blender/  world.blend + its glTF export, and the export script
    └── textures/ full-resolution temple textures and their PSD
```

## art/ — the runtime slots

`playable/src/art.js` is the only module that names a file. It looks for these by basename
and any of `.png` / `.webp` / `.jpg`:

| file    | what it is                                                          | status |
| ------- | ------------------------------------------------------------------- | ------ |
| `block` | one square tile — the stone block the wall is built from            | pending layout PSD |
| `gems`  | one horizontal strip of square frames, one frame per gem colour     | pending layout PSD |
| `rocks` | rubble atlas, 13 columns (tumble frames) x 4 rows (rock types)      | pending layout PSD |

Every slot is optional. With a file missing the game draws that element as a flat vector
shape and stays fully playable — which is how it runs right now. Dropping a file in is the
entire integration step; no code changes.

Atlas geometry is owned by `playable/src/debris_sim.js` (`ROCK_FRAMES`, `ROCK_TYPES`) and
imported by `art.js`, so the sheet and the simulation cannot drift apart.

## audio/

23 mp3 one-shots plus two loops (`bg_0`, `bg_1`). Not yet wired — the audio pass is still
open. When it is, these get inlined into the single-file build, so the set needs trimming to
a budget first; 509 KB of source is more than the creative should carry.

## fonts/

Baloo2 in three weights, ~2 MB of TTF. The game currently renders with `system-ui, Arial`.
Before shipping, the used weights need subsetting to Latin + digits and converting to WOFF2
— the full TTFs would roughly double the bundle for a handful of glyphs.

## source/

Authoring files, kept for provenance and future edits. Nothing here is imported by the
playable, so none of it reaches `dist/`.

`world.blend` is the temple scene: named marker empties for camera and hero positions, a
tile grid matching the match-3 board, and collider meshes. It drove the 3D build and is
retained because the character rig will be authored against it.
