# Core Mechanic Architecture — "2D match grid drives 3D colliders"

> **The single source of truth for how the puzzle connects to the 3D world.** If anything below conflicts with older notes, this wins. Confirmed against the references (`ref-1`: *"playable board (lower) + physics obstacle zone (upper) that matches drain/erode … board partially obscured by rubble that spills into gaps"*).

---

## The principle (one line)
**Player interaction is a clean 2D match-3 grid. Each grid cell is bound to a 3D block that has a collider in the scene. Matching a cell deletes its 3D block + collider — and the 3D world reacts to that collider disappearing.**

The match tiles themselves **never run physics and never tumble.** Only the *thing the colliders were holding back* is dynamic.

---

## The three layers

```
 LAYER C — the 3D world element held back by the wall
           (e.g. debris pile, water, a boulder, a platform…)
           ▒▒▒▒▒▒▒▒▒▒▒▒        ← the only DYNAMIC physics
           ▒▒▒▒▒▒▒▒▒▒▒▒
  ─────────╦═╦═╦═╦═╦═╦─────────
 LAYER B — wall of 3D blocks, one per cell, each with a
           STATIC collider. This is the dam / floor / support.
            ▣ ▣ ▣ ▣ ▣ ▣
            ▣ ▣ ▣ ▣ ▣ ▣
            ▣ ▣ ▣ ▣ ▣ ▣
 LAYER A — 2D match-3 grid logic + player interaction
           (swap two adjacent, match 3+). Clean, reliable,
           no physics. Maps 1:1 to Layer B.
```

- **A (logic/interaction):** the match-3 grid — swap, detect 3+ in a line, the no-refill / collapse rules we already built. This is data + input only.
- **B (structure):** every cell `(r,c)` owns a **3D block mesh + a static collider** at a fixed world transform. The grid of blocks forms a **wall / floor / dam** in the scene.
- **C (reaction):** whatever rests on / behind / above Layer B is held in place by those static colliders. It is the **only dynamic physics** in the scene.

---

## Lifecycle

1. **Setup:** build the 2D grid (A). For each cell, spawn a 3D block + static collider (B) at `worldPos(r,c)`. Place the world element (C) resting against the wall.
2. **Swap / match:** pure 2D grid logic (A). No physics involved.
3. **Clear:** when cells match, for each cleared cell:
   - delete the tile from the grid (A),
   - **destroy its 3D block mesh + remove its static collider body (B).**
4. **React:** with those colliders gone, the world element (C) **loses support and moves under physics** — drains through the gap, pours down, drops, etc.
5. **Collapse/refill:** Layer A's collapse rules run (cells above fall to fill, no refill); Layer B's blocks follow their cells to the new positions.

---

## Physics scope (the simplicity rule)
- **Dynamic (cannon-es):** ONLY Layer C (the held-back element). Bounded, capped, sleeping — same as the debris spike we already proved.
- **Static / kinematic:** Layer B blocks (just removed on match — never simulated as falling bodies).
- **No physics at all:** Layer A grid logic.

This is why it's simple: match-3 stays a 2D grid; physics is confined to one reacting element; removing a collider is a single cheap operation.

---

## Rendering & input
- **Interaction** is grid-based (tap/swap a cell). Implement either as raycast onto the 3D blocks mapped back to `(r,c)`, or a 2D input layer aligned to the grid — both resolve to "which cell."
- **Visuals:** the tiles are the 3D blocks (Layer B) rendered in the Three scene, so the board is part of the world (not a flat overlay). **Pixi is HUD/overlay only** (logo, buttons, outcome text).

---

## What Layer C is = the level-design variable (debris is OPTIONAL)
The architecture is agnostic to *what* the wall holds back. Debris is just one option — and possibly more complex than needed. Simpler real-world reactions that use the exact same setup:

| Layer C option | What happens when blocks are removed |
|---|---|
| **Debris pile** | rubble/gold pours through the gaps and drains away |
| **Water** | water floods through the opening and drains / lowers |
| **A single big object** | one boulder / idol / slab drops through once enough support is gone |
| **A platform the character stands on** | the floor opens and the character drops to safety |
| **A counterweight / held object** | the held thing falls, pulling a rope that lifts the character |
| **Nothing held — just a barrier** | the wall *is* the obstacle; clearing it simply opens the path the character walks through |

> The last row is the **simplest possible** interaction: the block-wall itself blocks the character's escape, and clearing it opens the path — no separate dynamic element at all.

---

## Status / open
- **Locked:** this 2D-grid → 3D-collider architecture; threat leaning = **closing crushing walls** (the timer); setting = temple/explorer (see [[game-design]]); stack = Vite + Three + Pixi(HUD) + cannon-es (see [[foundation-decision]]).
- **Open:** the level design — specifically *what Layer C is* (debris vs water vs platform vs nothing) and exactly how the character escapes. Leaning toward the **simplest** option that reads in 3 seconds.
