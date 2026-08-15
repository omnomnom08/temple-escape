# Temple Escape — remaining work

**The rig has landed and is integrated.** The character was the long pole of this document and it
is now off the critical path: he loads, stands in the right place at any aspect ratio, wears his
texture, and answers to the game's stamina. What is left is scene work — the spikes, the rope
outro, the intro reveal, the dust.

**State of play**

| | |
| --- | --- |
| **Done** | Win card; fail outcome; **the rig — loaded, placed, textured, and driven by stamina** (items 2, 3a–3g) |
| **Next** | Spikes advance (5); rope outro (4); intro reveal (6a) |
| **Temporary** | The door-run outro, to be replaced by the rope |

Build is **3,488.89 kB / 1,689.74 kB gzip**, up 777 kB from 2,711 kB for the rig. The unoptimised
GLB would have put it near 4.4 MB.

**Win card — closed.** Went well past the original P3 scope: `WIN` title wired, `OPEN` exported and
placed (`NEXT_LEVEL` retired), `chest.js` for the lure hop, `sparkle.js` for the glint field,
`confetti.js`, and a three-layer breathing glow with the linear-dodge layer composited additively.
Placement moved off manifest geometry onto `box()` / `_placeFromDoc` / `fromDoc`.

One loose end left behind: `layers/manifest.json` still carries a `NEXT_LEVEL.png` entry for a file
that no longer exists. Harmless — nothing imports it, so `layer('NEXT_LEVEL')` is null either way —
but worth deleting next time the manifest is open.

---

## P0 — Fix and unblock

Both closed.

### ~~1. The fail outcome never fires~~ — FIXED

**The prime suspect recorded here was wrong, and worth reading before trusting a hunch in this
file again.** It blamed `RELIEF_SECONDS` (6s) out-running `CREEP_SECONDS` (14s). Instrumented over
a hands-off round, only 7% of frames ever relieve, and `push` does not decay — it *plateaus* at
0.43 and sits there for the rest of the round. The two constants were innocent. `CRUSH_FORCE = 130`
was innocent too: `rawPressure` hits 1.000 repeatedly.

**The real cause was a feedback loop through the pillar.** `game.js` drives `bounds.left` off
`scene.pillarRight`, so the shaft's left wall retreats as `push` grows. Settled rock sleeps, and
`setLeftBound` only did something in the *advancing* case (`pushRightOf`) — nothing woke the mass
when the wall backed away from it. So the pillar slid left, the pile stayed put, a few px of gap
opened, and `wallForceLeft` — which samples one pack cell at `bounds.left` — ended up measuring the
gap. Load at the face fell 418 → 20 and `rawPressure` with it, 1.00 → 0.07.

Being pushed was the thing that stopped the pushing. Held the wall still as a control: fail at 15.7s.

**Fix:** one line in `setLeftBound` — `wakeColumn` the face slice when the wall gives ground, so the
mass slumps in and follows it. Not a ratchet: the mass visibly detaching from the pillar it was
supposed to be crushing was the actual bug, and a ratchet would have hidden it behind arithmetic.

**Then retuned `CREEP_SECONDS` 14 → 10.** 14 had never been measured against a round that can end;
once one could, it meant 17.1s of standing still before the spikes. 10 puts a hands-off death at
13.0s while a brisk player still wins every round. 8 was tried and rejected — 11.4s, but an
unhurried player loses ten rounds in twelve, and in an ad the chest is the payoff.

Locked in by `test/debris.test.mjs`, "a wall that gives ground must not be abandoned by the pile" —
which tests the sim contract that actually broke rather than re-deriving `board2d`'s integrator.

Side effect worth knowing: `push` is now genuinely two-way, so the stamina ring visibly refills when
a drain gives him ground back. `_drawStamina` always claimed to do that and never could.

### ~~2. The Three canvas does not track Layout~~ — DONE

`hero3d.js` rendered through an orthographic camera spanning `0..1280` onto a canvas that
CSS-stretches to the full viewport, while the Pixi world is cover-scaled and centred by
`layoutChanged()`. The two only agreed when the viewport was exactly square.

Fixed by `hero3d.setViewport(layout)`, called from `layoutChanged()` and replayed by `hero.js` when
the rig finishes loading — the boot resize almost always beats it. Verified by screenshot at 720×1280
and 1280×720, which have different origins in *both* axes: feet on the ledge and correct scale in
each.

`Layout.edges` already reports the screen edges in document coordinates, and `place()` already
converts Pixi y to Three y as `H - y`, so the frustum is those same edges y-flipped:

```js
setViewport(layout) {
  this.renderer.setSize(layout.vw, layout.vh, false);
  const e = layout.edges, c = this.camera;
  c.left = e.left;         c.right  = e.right;
  c.top  = this.H - e.top; c.bottom = this.H - e.bottom;   // Three's +Y is up
  c.updateProjectionMatrix();
}
```

- Call it from `layoutChanged()` alongside the existing `setSpawnY` / `setDrainY` pair, and once at
  rig-load time — the rig arrives async and will usually miss the boot resize.
- `setSize(vw, vh, false)` leaves the CSS alone, which is right: `#three-canvas` is already
  `inset: 0`, so the backing buffer ends up 1:1 with the stretched element.
- Bonus: this is also what makes "off the top of the screen" correct for the rope at every aspect ratio.

---

## P1 — The scene around him

Item 3 is closed; 5 is the cheapest win left and 4 is the biggest.

### ~~3. Integrate the delivered rig~~ — DONE (3a–3g)

**All of it shipped.** The rig loads, is placed and scaled off Layout, wears the palette atlas, and
steps through the three stamina phases with `push` playing while he wins ground. Verified in a
headless browser: console clean, no missing clips, correct placement at two aspect ratios, and the
poses observably changing as the stamina ring drains.

What remains for the character is in items 4 (rope outro) and 6a (intro reveal), not here.

The measurements below stay because they are the reference for anything that touches the rig next —
they were expensive to establish and the file cannot state them.

`assets/art/3d/hero.glb` did **not** match the clip contract `hero3d.js:21` was written against, and
the mismatch was in the rig's favour in two places and against it in one.

#### What was actually delivered

glTF 2.0, Blender I/O v5.1.18, **0.60 MB** after the re-export in 3g. One skinned mesh (6,704 verts
/ 9,395 tris), one material (`world.001`, no texture — see 3b), 28 deform joints, 30 nodes total.
Character is 2.04u tall in bind pose.

| Clip | Length | Loops? | Root motion (hips) |
| --- | --- | --- | --- |
| `idle_0` | 0.67s | seamless (0.15°) | none |
| `idle_1` | 0.67s | seamless (0.18°) | none |
| `idle_2` | 0.50s | seamless (0.04°) | none |
| `push` | 2.73s | **seamless (0.12°)** | none — returns exactly to origin |
| `land` | 1.13s | one-shot | falls 0.57u, **contact at t=0.50s**, settles by 0.93s |
| `rope` | 2.67s | one-shot | **+4.26u lateral, −1.08u net down** — a pendulum |

Semantics, from the author: `idle_0/1/2` are stamina phases, stepping **0 → 1 → 2** as stamina
drains and back down as it recovers. `push` is him shoving the pillar. `land` is the intro. `rope`
is the outro.

**Orientation is already right, by luck or by care.** The rig's left–right axis is Z and it faces
**+X**, which under the existing orthographic camera is screen-right — straight at the pillar. The
brace, the idles and the push all read correctly with no rotation. Only the rope needs a yaw
(below), because its swing plane is perpendicular to the push plane.

#### ~~3a. Make it load at all~~ — DONE

- `art.js:18` globs `../../assets/art/*.glb`. The file is at `assets/art/3d/hero.glb`, so
  `modelURL('hero')` returns null and the rig **silently never loads** — you get the placeholder and
  no error. Widen to `../../assets/art/**/*.glb`, and note the path must stay rooted at
  `assets/art/`: `assets/source/blender/world.glb` is not used by the build, and `import.meta.glob`
  with `eager: true` bundles whatever it matches whether or not anything reads it — being unused is
  no protection. That is the exact trap the comment above that glob was written about.
- Do item 2 first. Non-negotiable; see above.

#### ~~3b. Rig setup in `hero3d.js`~~ — DONE

- **Clip set** becomes `['idle_0','idle_1','idle_2','push','land','rope']`. The existing
  missing-clip warning is worth keeping — it is what will tell you a re-export dropped an action.
- **Auto-scale off `body_placeholder`, not the whole scene.** The old warning in this document was
  right in principle and is nearly a problem in practice: the export carries a `cs_grp` collection
  of 19 bone-widget objects at up to y=18.5, against a 2.04u character. They are empty nodes today
  so `Box3` ignores them and the scale is correct by accident. Measure the named mesh node and the
  accident stops mattering.
- **Texture: the GLB ships without one — assign `texture_world.webp` at load.** The re-export drops
  the 163 KB embedded PNG in favour of the 9 KB WebP already in the repo. Until it is assigned the
  character renders flat grey, so this is not optional polish.
  - The material's `baseColorFactor` is `0.8, 0.8, 0.8` and multiplies the map. Set
    `material.color.setScalar(1)` when assigning, or every colour ships 20% dark.
  - UVs survived the export (`TEXCOORD_0` is present) — worth re-checking after any future
    re-export, because "Images: None" and "no UVs" look identical on screen.
- **Turn mipmaps off on that texture.** It is a palette atlas — ~30 vertical colour strips across
  512px, so ~17px each. At the size the hero renders, mip levels blend neighbouring strips and the
  colours go muddy and wrong. `generateMipmaps = false`, `minFilter = LinearFilter`, `colorSpace =
  SRGBColorSpace`.
- Optional, low value: the material uses `KHR_materials_specular`, so Three builds a
  `MeshPhysicalMaterial`. The scene is lit flat by design; Lambert would be cheaper and look the
  same. Not worth doing until something is actually slow.

#### ~~3c. Stamina phases~~ — DONE · the one real design change

`hero3d.js` was built to run `brace_idle` and `strain` simultaneously and cross-fade them by
*weight*, on the argument that quantised feedback would ruin the loop. **That argument does not
survive the delivered clips.** Adjacent phases differ by 122° and 103° at the upper arm (0 → 2 is
161°). Holding a partial weight blend between poses that far apart puts the arm through a
meaningless midpoint. These are states, not endpoints of a continuum.

So: a three-state machine with a cross-fade on transition, not a permanent blend.

- **Drive it off `push`, not `pressure`.** `game.js:633` currently passes `board.pressure`, which is
  the spiky low-passed contact force. The author's word is "stamina", the stamina ring is `1 - push`,
  and stepping states on a spiky signal would flicker. Driving both off `push` also guarantees the
  ring and the character never disagree. Rename `setStrain` → `setFatigue` while changing the
  argument, so the two cannot be confused later — three call sites.
- **Hysteresis, or it chatters.** Bare thresholds at ⅓ and ⅔ flicker whenever `push` hovers on one.
  Enter phase 1 at 0.35 and fall back at 0.28; enter phase 2 at 0.68 and fall back at 0.60.
- Cross-fade ≈0.3s. All three loop seamlessly and share the bone set, so `crossFadeTo` is clean.
- Their periods differ (0.67 / 0.67 / 0.50). Match `timeScale` to a common cycle while a fade is in
  flight so the two clips do not visibly drift apart mid-blend.

#### ~~3d. `push` while he is winning ground~~ — DONE

Decided: `push` loops **whenever stamina is recovering** — the player cleared plates, the shaft
drained, the pillar is going back. Idle phases play the rest of the time. The reward for a good
match becomes visible on the character, and it needs no new signal: `push` (the value) decreasing
*is* the condition.

- Debounce it. Single-frame noise in the derivative would strobe between `push` and an idle. Enter
  after the value has fallen for ~0.1s, leave after it has stopped falling for ~0.3s.
- The clip is a true loop with zero root drift, so it can be held indefinitely and cross-faded out
  at any point.

#### ~~3e. Intro: landing sync~~ — DONE

`land`'s foot contact is at **t=0.50s**; `hero.js:19` drops the root over `T_FALL = 0.55s`. Move
`T_FALL` to 0.50 so the clip's impact and the root's landing are the same instant. The clip then has
0.63s of settle left, which overlaps the first moments of play — better for an ad than holding the
board hostage until the body stops moving.

- Gameplay still unlocks at `TOTAL`; only the fall segment shortens.
- The Pixi squash tweens `root.scale`, and the rig is positioned by `place()` rather than parented to
  `root`, so it is placeholder-only already. No double-squash to guard against.
- `land` ends with hips at 0.93 and `idle_0` sits at 0.90 — near enough to cross-fade in 0.25s.

#### 3f. Fail — nothing to do

Decided: cut away before impact. `_fail()` already goes straight to the card, so this beat is
finished as written. No `fail` clip is needed.

#### ~~3g. Re-export, deform-only~~ — DONE, 1.25 MB → 0.60 MB

The first GLB inlined to ~1.6 MB of base64 (`assetsInlineLimit` is effectively infinite) and would
have taken the build from 2.71 MB to ~4.3 MB. Most of it was measurably dead: **79 of its 107
skeleton joints carried zero vertex weight** — the IK/FK control rig, animated in full by all six
clips — plus a 163 KB embedded PNG of an image already in the repo at 9 KB as WebP.

Resolved via `assets/art/3d/hero.fbx`, which was exported clean (28 bones, all deform, all
weighted), converted headlessly through Blender 5.1 and re-exported as glTF with `Images: None`,
`Only Deform Bones`, no cameras/lights, no Draco.

| | before | after |
| --- | --- | --- |
| File | 1,254,308 B | **631,692 B** |
| JSON chunk | 415 KB | 119 KB |
| Animation data | 250 KB | 101 KB |
| Skin joints | 107 (28 weighted) | 28 (28 weighted) |
| Nodes | 129 | 30 |
| Animation channels/clip | 321 | 87 |

Verified equivalent, not merely smaller: identical mesh (9,395 tris), identical bind pose (2.04u
tall, 1.81u arm span), identical loop closure on all three idles and `push`, identical `rope` and
`push` hip paths. `land` and `push` each gained one frame — see the clip table — because the FBX
carried a slightly different take; see the note below.

Two follow-ups, neither blocking:

- **The .blend holds two sets of the same six clips**, differing by under 1% of keyframes. In
  Blender they are `idle_0` (authored) and `Armature|idle_0` (a previous FBX export imported back
  in — the only way that prefix appears). The conversion keeps the authored set. Worth deleting the
  other in the .blend so the ambiguity cannot resurface; nothing downstream depends on it.
- The conversion script currently lives only in this session's scratch. If animations get retouched
  it will be needed again, so it belongs in `tools/` alongside `optimize-art.mjs`.

Direct glTF export from the .blend remains preferable to the FBX route when convenient — FBX
flattens the action namespace, which is what made the duplicate set ambiguous in the first place.

### 4. Rope outro — Code + small texture, M · now uses the delivered `rope` clip

Replaces `runTo(door)` in `_win()`. The Pixi rope half still needs no GLB and can be built first.

- **Rope:** Pixi `MeshRope` over a point array, not a sprite sheet — a single tileable strip costs
  single-digit KB against hundreds for a sheet, and the length has to be dynamic anyway to reach
  `layout.edges.top` at every aspect ratio.
- **No jump button.** He jumps on his own after a short beat; a tap during that beat fires it early.
  The auto-timer was needed as a no-input failsafe regardless, so this costs nothing and keeps the
  player's last tap for the CTA.
- **Hide the grab in a fade.** This removes the expensive problem — hand-to-rope contact is never
  shown, so a Pixi rope drawing behind the Three canvas stops mattering.
- **Swing after the grab, not before.** A rope swinging in place was only ever the timing window for
  the button; without it that is dead air.
- **Beat:** drop ≈0.4s → jump + fade ≈0.3s → hang, swing, rise ≈1.2s → end card. Under two seconds.

Three things the delivered clip changes:

- **Yaw the rig 90° for this beat, inside the fade that already hides the grab.** The swing plane is
  the rig's YZ, perpendicular to the push plane, so with the normal camera he would swing directly
  into the screen and read as nothing. `group.rotation.y = +Math.PI/2` maps the clip's +Z travel to
  screen-right, which is the way the door is. Costs nothing — the fade is already in the beat.
- **The clip ends 1.08u *lower* than it starts.** It is an honest pendulum: down through the arc at
  t≈1.4, back up at t≈2.1, settling low. Decided: play the clip for the body language and tween
  `group.position.y` upward underneath it, so the net path is across-and-up and out of frame.
- **It is 2.67s against a ≈1.2s slot.** Its first half-second is a static hang — x and y are flat
  until t≈0.5. Start there and run at `timeScale ≈ 1.3` and the remaining 2.17s fits in ~1.67s.

### 5. Spikes advance on the character — Code, S · best value on the list

Half of this is already done — `spikes` is a separate sprite in `scene.js`
(`BEHIND = ['wall', 'shadow', 'spikes']`), not part of the wall. Only the growth is missing.

- It is placed top-left anchored at x=367, so scaling `scale.x` already extends it rightward, toward
  the hero at x=432. The anchor you want is the one it has.
- Drive it off the existing `push` in `Scene.setPush()`, the same 0..1 that already moves the pillar.
  A handful of lines, and the threat reads on two elements instead of one.
- Better value now than when this was written: `push` used to stall at 0.43, so the spikes would
  have crept a third of the way and stopped. It now runs the full 0..1, so this reads properly.

---

## P2 — Depth and intro

### 6. Intro: wall reveal, then fall and land — Code, M · splits

- **(a) 2D mask reveal of the plate wall** — independent of the rig, do it now. Hooks into
  `_enterScene()` and `board.show()`, which currently just flips visibility.
- **(b) the rig's landing** is item 3e, not this item — the clip is `land`, not `fall`, and its
  contact frame sets `T_FALL`. Note the deliberate design in `hero.js` either way: the drop runs off
  `update(dt)` rather than GSAP so it can never stall the state machine. Keep the clip decorative on
  top of that; do not make landing depend on it.
- `hero.js:_loadRig` already swaps placeholder for rig, so the wiring is a couple of lines.

### 7. Foreground dust and falling rocks — Code + sprites, M · needs a decision

Cheap to build once the layering question is settled: a light particle emitter reusing the existing
`vfx/` art and the rock sheets already in the bundle. The depth cue is worth it — right now every
moving thing sits on one plane.

---

## ~~P3 — Win card polish~~ — DONE

Shine particles, `WIN` title and the `OPEN` button all shipped, plus the chest lure and confetti.
See the state-of-play note at the top.

---

## One decision blocking the dust

You asked for dust and rocks "in front of everything but under the walls". There is nothing to be
under: `walls` is one of the four layers baked into `bg.png` — with `brick_back`, `bg_wall` and
`bg_fog` — and that composite is drawn first, as the backdrop. So today the walls sit behind every
moving thing in the scene.

- **Option A** — dust is simply a foreground layer over everything, reading as atmosphere close to
  camera. No re-bake, no extra bundle weight.
- **Option B (recommended)** — pull `walls` out of the bake, re-bake `bg.png` from three layers, and
  draw `walls.png` as a foreground occluder above the dust. `walls.png` is already extracted and
  sitting in `layers/`. Costs a re-bake and one more sprite in the bundle. Pick this if you want the
  dust to read as falling *inside* the shaft, which is what gives you the depth you are after.

---

## How it parallelises

Barely two tracks any more. The rig is delivered, optimised and integrated, so Blender is down to a
rope strip and some dust sprites — nothing gates the code.

| Phase | Art / Blender | Code |
| --- | --- | --- |
| **1 · now** | Rope strip texture | Spikes advance (5) |
| **2** | Dust sprites | Rope outro end to end (4); wall mask reveal (6a) |
| **3** | — | Dust and rocks (7), once the layering decision below is made |

---

*Code anchors were read from the working tree. Line numbers will drift as you edit — the surrounding
identifiers are the durable reference.*
