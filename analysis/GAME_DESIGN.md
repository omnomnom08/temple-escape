# Game Design — "Save the Explorer" Playable Ad

> Our locked creative + mechanic spec. Sits on top of `REFERENCE_ANALYSIS.md` (design DNA) and `BUILD_PLAN.md` (execution/assets). Supersedes the placeholder mechanic shipped in the first `/playable` demo.

---

## 1. Setting & world (LOCKED)

**Real-world adventure — an ancient stone temple / jungle ruins.**
Sun-warmed sandstone blocks, lit torches, hanging vines, golden idols, treasure chests, carved crown/relief motifs — a warm "lost temple" vibe.

**Why this setting:** real-world adventure settings perform better on ad metrics than abstract/fantasy ones, and a recognizable **Indiana-Jones-style explorer** archetype pulls in a wider audience and increases engagement/recognizability.

**Art direction reference:** `analysis/art-direction/explorer-setting-reference.png` — a **user-generated ChatGPT image**, used as our **style/mood target**. The "[TITLE]" logo in it was **auto-added by the image generator** and is **not** part of our design — it will be dropped. We ship **100% original, logo-free** assets and our **own branding**, designing our own explorer in this archetype/style rather than reproducing any third-party character verbatim. ("Adventurer in a fedora" is a common archetype and fine to design originally.)

**Palette:** warm sandstone `#d8b079`/`#b98b4f`, deep shadow `#3a2a1e`, torch fire `#ff9a2e`/`#ffd24a`, gold `#e8b422`, jungle green `#5f9a3c`, danger lava/orange `#ff4b1a`. Glossy 3D casual render, soft warm lighting.

---

## 2. Character (LOCKED archetype, original design)

An **original adventurer-archetype hero**:
- Brown **fedora**, **leather jacket** over a light shirt, **satchel** strap, coiled **whip**, belt, boots.
- Friendly cartoon proportions — large head, big expressive eyes, glossy stylized-realism render.
- Expressive states needed: **idle/worried**, **climbing/escaping**, **cheer (win)**, **peril (fail)**.
- Own name + look (no likeness to the reference title). Working name TBD.

---

## 3. Core mechanic (CORRECTED — this is the important fix)

**Match-3, with permanent removal that directly frees the escape.**

- The hero's escape route (a temple shaft / blocked doorway) is **packed with colored blocks**. **The block field IS the obstacle** — there is no separate board + abstract meter.
- Player **swaps two adjacent blocks** to line up **3 or more** of the same color (classic match-3).
- Matched blocks **pop and are permanently removed** — **NO refill, NO new tiles spawn**. The board only ever shrinks.
- Remaining blocks **collapse by gravity** into the freed space (pile settles downward) but nothing respawns.
- **Clearing blocks directly opens the path**: as blocks vanish, the hero climbs/advances upward through the cleared space. **Clear the blocking path → the hero escapes → WIN.** The cleared space *is* the rescue (no "rescue %" abstraction).

### What was wrong in the first demo (to rebuild)
| First demo (wrong) | Correct design |
|--------------------|----------------|
| Tap any group of **2+** | **Match-3**: swap to align **3+** |
| Tiles **refill** infinitely from the top | Tiles **permanently removed, no respawn** |
| Abstract **RESCUE meter** fills | **Clearing the blocks itself** frees the path — no meter |
| Board separate from the danger scene | **Block field = the obstacle** in the hero's escape path |

> Dead-end handling: since there's no refill, if no 3-match remains among the leftover blocks, reshuffle the remaining blocks (don't add new ones) so the path can always be finished.

---

## 4. Threat / timer (LOCKED behaviour, hazard art = temple-appropriate)

A visible, always-advancing threat = the timer. Recommended: **rising lava** in the temple shaft (warm, high-contrast, reads instantly). Alternatives that fit the setting: collapsing ceiling, a descending snake, rising water/sand.
- The threat advances on a fixed pace (and/or surges if the player stalls).
- If it reaches the hero before the path is cleared → **FAIL**.

---

## 5. Outcomes & flow

- **WIN:** path fully cleared → hero scrambles up and out, grabs the idol/treasure → **"SAVED!"** stamp + confetti → pulsing **"Play Now!"** CTA (`sdk.install()`).
- **FAIL:** threat reaches the hero → **"OH NO!"** stamp → **"Try Again"**.
- **Retry:** rebuild the block field + reset threat + reset hero (`sdk.on('retry')` and the in-ad button).

---

## 6. First-3-seconds readability

- Hero visibly **trapped behind the blocks**, threat **already advancing**.
- Tutorial cursor demonstrates **one swap** that pops a 3-match and **visibly opens a gap + nudges the hero upward** — teaching "match the blocks → free the explorer" with zero text.

---

## 7. Build implications (vs. current `/playable`)

- **Keep:** Vite + Three (scene) + Pixi (blocks/UI) + `@smoud/playable-sdk` foundation; threat-as-timer; win/fail/retry; CTA; responsive portrait stage.
- **Rebuild `board.js` + `game.js`:** finite block field, swap-based match-3, permanent removal, gravity collapse without refill, reshuffle-on-no-moves; couple cleared rows directly to the hero's climb height + the opening path (remove the RESCUE meter).
- **Reskin:** temple/lava scene dressed in warm sandstone/torches/gold; original adventurer hero model replacing the placeholder.
- **Assets:** per `BUILD_PLAN.md` §4, CC0 sourced + original hero; track in `/assets/ATTRIBUTIONS.md`.
