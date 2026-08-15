# Shipped reference creative — asset teardown

> **Source:** `reference-bundle/` (120 files, 12 MB) — the decoded Luna bundle for the same creative as `SHIPPED_CREATIVE_CONFIG.md`. `assets/bundles/-1/bundle.json` (8.4 MB) preserves the **full Unity project structure**: 32 prefabs, 22 scriptable-objects, 132 sprites, 96 textures, 17 materials, 15 sounds, 5 meshes, 5 animation clips, 1 scene.
> **These are the publisher's copyrighted assets.** Reference and spec only — we ship our own art. Extracted 2026-08-11.

---

## 1. The rock debris system — completely solved

This is the whole answer to L1, with numbers.

### The art
```
Art/Sprites/Rocks/Rock01_Grey/Rock01_Mat_Grey0000.png … 0012.png
Art/Sprites/Rocks/Rock02_Grey/…  Rock03_Gray/…  Rock04_Grey/…
```
- **4 rock types × 13 frames = 52 sprites.** Individual files, not an atlas.
- Every frame is **140 × 140 webp**.
- **Total for all 52: 84.6 KB.** The entire debris art budget is under 0.1 MB.
- Folder names say it outright: **`_Grey`**, and the files are `*_Mat_Grey0000`. Authored greyscale, colored at runtime. My inference in `SHIPPED_CREATIVE_CONFIG.md` §1 is confirmed by the file names.

### What the frames actually are
Frame `0000` and frame `0012` are the same orientation — **it's a looping tumble**, 12 unique steps plus the loop-back frame. The art is a soft-faceted, softly-shaded greyscale rock with no outline: unmistakably **pre-rendered from a 3D model**, not hand-painted.

**This is a Blender job, not an illustration job.** Take one low-poly rock, clay/greyscale material, flat neutral light, rotate 30° per frame across 12 frames, render 140×140 with alpha, export webp. Repeat with 4 rock shapes. That's maybe 20 minutes of your time for the entire debris art set — and you already have the scene lighting set up.

### The shader (`Material_Rock01.mat`)
```
shader 744, renderQueue 3000 (transparent)
floats : _Intensity 1 · _Saturation 1 · _LightnessMix 0 · _BaseGrey 0.43
color  : _TintColor  (0.851, 0.133, 0.133, 1)     ← RED
texture: _MainTex = null                           ← assigned at runtime
```
Two things worth noticing:

1. **`_BaseGrey` + `_TintColor` is exactly the pipeline I described** — normalize the greyscale by its own average, multiply by the tint. Plus `_Intensity` / `_Saturation` / `_LightnessMix` as trim knobs. Easy to reproduce as a tiny Three.js `ShaderMaterial`, or approximate with `MeshBasicMaterial` + vertex colors if we skip the knobs.
2. **The material ships RED (`_BaseGrey 0.43`), but the runtime config re-tints to sandstone (`rock1BaseGrey 0.55`).** Same sprites, different palette, zero extra art. The "re-palette for free" claim isn't theory — the shipped build does it.

Prefab names are `SilverBall(Clone) (2).prefab` ×3 — these rocks are a re-skin of the gold/silver ball prop from another creative. Same system, new tint and frames.

---

## 2. The design philosophy — one idea applied everywhere

> **Pre-render 3D to greyscale sprite frames → tint at runtime → animate by frame index.**

- **Rocks:** 4 × 13 greyscale frames + tint.
- **Snake:** `Snake_Head_Frame1/2/3.png` + `Snake_Body.png` — frame-by-frame, not skeletal.
- **Particles:** `ParticleAtlas.png` is **all white** — soft circle, star burst, ring, 4-point sparkle, vertical and horizontal streaks, soft rounded rect. Eight primitives, tinted at runtime, one `Additive Particle Material`. That is the *entire* FX vocabulary of the ad.
- **Gems:** `ItemPartsAtlas.png` holds faceted gem **shatter shards** in each color — a cleared gem breaks into pre-rendered 3D-looking chunks.
- **Display text:** `Texts/PlayAtlas.png`, `CongratsAtlas.png`, `FailAtlas.png` — the big words are **pre-rendered images**, not live font rendering. (A TMP font, Mikado Simple, ships only for the banner line.)

Almost nothing is rendered as real 3D at runtime. Only **5 meshes exist in the entire ad**, and one of them is Unity's default Cube.

---

## 3. Characters — the 3D/2D split
```
Art/Models/Push_idle_Robert_Body_Rig.glb          ← in-game King, real 3D
Art/Animations/King/  Idle · Run · PushWalk · ThrowShield   (+ KingAC.controller)
Art/Textures/Rob_Bakev5_final.jpg                 ← single baked texture
Modules/EndCard_05/…/King_SkeletonData.asset      ← end-card King, Spine 2D
Modules/Tutorial/…/tutorial_hand_SkeletonData     ← tutorial hand, Spine 2D
```
**The gameplay character is one rigged GLB with a single baked texture and exactly four animation clips.** The end-card king and the tutorial hand are Spine 2D instead — cheap where no 3D is needed.

Directly relevant to **D2** (our hero is still `body_placeholder`): the bar is *one* rigged character, *one* baked texture, *four* clips. Idle, Run, Push, and one action. That is a realistic 4-day target, and it tells us not to over-spec the hero.

---

## 4. Audio — 15 files, and the design is copyable
```
match_item/MatchExplode_01…06_SFX.ogg     ← SIX variants of the same event
match_swipe/MatchSwipe_01_SFX.ogg
rock_fall/MarbleRoll3.ogg                 ← the flow/landslide sound
background/CoinEscape_BG.ogg
fire_whoosh/Dragon_01_SFX.wav · AttackParticleShoot_SFX.ogg
SFX_LogoReveal · SFX_Vignette · SFX_FailBadge · SFX_Congrats
```
**Six variants of the match-clear sound**, round-robined so the most-repeated action in the ad never fatigues the ear. That is the cheapest polish trick in the whole teardown, and we can do it today — `assets/sounds/` already has `bubble_0/1/2`, `glass_hit`, `hit`, `crash_wood` to rotate through.

The landslide sound is literally a **marble roll** recording, gated by the `flowMinRockCount ≥ 10 / speed > 3 / 0.7 s cooldown` rule from `SHIPPED_CREATIVE_CONFIG.md` §1.

---

## 5. Module architecture (what an ad of this quality is made of)
```
Match-3 · Tutorial · Snake · Banner · Vignette · Logo · Smoke ·
ProgressBar · Texts · CongratsCard_01 · FailCard_01 · EndCard_05
```
The numbered suffixes (`_01`, `_05`) are **A/B variants** — they ship interchangeable card modules and pick per campaign. `ProgressBar` carries three meter icons (`Fire_S`, `Health_S`, `Stamina_S`), also swappable.

Worth noting for our scope: they ship **separate Congrats, Fail, and End cards** as three distinct modules. Our single overlay with swapped text is the budget version of this, and that's a fine simplification to declare in the README.

---

## 6. Adopt list (additions to `SHIPPED_CREATIVE_CONFIG.md` §6)

| # | Change | Where | Note |
|---|---|---|---|
| **A10** | Rock art = **4 shapes × 13 greyscale frames, 140², webp**, pre-rendered tumble loop in Blender | your art | ~85 KB total; a render job, not a painting job |
| **A11** | Tint shader with `_BaseGrey` + `_TintColor` (+ intensity/saturation) | W1 | small `ShaderMaterial`; lets us re-palette free |
| **A12** | One **white** particle atlas (circle, star, ring, sparkle, streaks) tinted at runtime, additive | W1/W5 | 8 primitives covers every FX in the ad |
| **A13** | Gem clears shatter into pre-rendered **fragment sprites** | W1 | reuses the same tint pipeline |
| **A14** | **6 match-clear SFX variants**, round-robined; swipe SFX separate | W4 | do it with existing sounds now |
| **A15** | Big display words (`SAVED!` / `OH NO!`) as **pre-rendered images**, not live font | W5 | prettier and cheaper than TMP/Pixi text |
| **A16** | Hero spec ceiling: **1 rigged GLB, 1 baked texture, 4 clips** (idle/run/push/action) | D2 | keeps the hero achievable in 4 days |

**Budget reality check:** their entire debris art is 85 KB and their FX vocabulary is one small atlas. Nothing in this teardown threatens our ≤3 MB cap — our risk remains the 2 MB+ temple textures (`REBUILD_PLAN.md` R2), not the new systems.
