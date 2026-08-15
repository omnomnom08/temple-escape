import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { Board2D } from './board2d.js';
import { Hero } from './hero.js';
import { Scene } from './scene.js';
import { DOC, layer, url, box, VFX_SPARKLE_URL } from './layers.js';
import { Audio } from './audio.js';
import { Chest } from './chest.js';
import { SparkleField } from './sparkle.js';
import { Confetti } from './confetti.js';
import { Rope } from './rope.js';
import { Dust } from './dust.js';
// Where the call to action goes. Shared with vite.config.js, which hands the same URL to the
// playable SDK as its store defines — see cta.js for why it is not written out twice.
import { CTA_URL } from './cta.js';

// Composition and state. Two containers hang off the stage:
//
//   world — document space (1280x1280), scaled and centred by Layout. Everything painted.
//   hud   — also document units, but anchored to the SCREEN edges rather than the artboard,
//           because the PSD parks the stamina meter and cursor off-canvas on purpose: they
//           are shared between portrait and landscape and positioned at runtime.

const DANGER_AT = 0.6;   // pillar travel (board.push) above this starts the HURRY warning

// Grid geometry, measured from the layer manifest. Columns sit at doc x 546/608/671/733/796
// and rows at y 544/613/681/749/818/886, with 63x69 plates.
const GRID = { originX: 546, originY: 544, cellW: 62.5, cellH: 68.4 };

// Box the end card has to fit inside, in design px. Taken from the win card's PSD extent: the
// WIN title spans 298 px either side of the document centre, and the content runs from 442 px
// above it (title top) to 500 px below (button bottom). The card scales about its centre, so
// what has to fit is twice the LARGER half — 2x500, not the 942 px the content actually spans.
// Plus a little air.
//
// The card is centred in the visible box AND scaled to fit it. Only the position used to be
// set, which was survivable while the card was a chest and a button, but the visible box in
// landscape is about 590 design px tall against 1280 in portrait, and the full PSD composition
// is far taller than the hand-set one it replaces.
const CARD_W = 620;
const CARD_H = 1020;

// The win card's button placement, read from the PSD layer record rather than the manifest.
// The document has TWO layers named `btn` — this one and the CTA — so the extractor cannot key
// them apart, and the `btn_0` entry an older extract invented for the collision now matches no
// file. These four numbers are the second `btn` layer's own rect. If the extractor ever learns
// to disambiguate duplicate names, this goes back to being a box() lookup.
const WIN_BTN_BOX = { x: 411, y: 960, width: 458, height: 178 };

// The OPEN label, likewise not a manifest lookup. The extract still reports the button's old
// NEXT LEVEL text, which no longer exists in the document; OPEN was recovered from the PSD
// composite instead, and these are the bounds of what came out. Both go back to box() lookups
// the moment the extractor is re-run against the current PSD.
const OPEN_BOX = { x: 554, y: 1007, width: 164, height: 56 };

// The win card does not wait for him to land. It starts this long before the swing's timeline
// ends, so the dim is already coming up while he is still on the rope and fading out on it —
// the card follows the escape instead of queueing behind it. Measured off the timeline's own
// clock in _awaitAllBut, so retuning the swing does not retune this.
const WIN_CARD_LEAD = 0.35;

// The rig and the lifted spike tips draw on #three-canvas, which sits above every Pixi layer,
// so the end card's dim cannot cover them — they have to take themselves off. The two cards
// need different speeds: the win has already faded him out over the last half-second of the
// swing, but on the fail he is standing in full light at the moment the card arrives, and any
// overlap at all reads as him surviving the spikes.
const END_FADE = 0.3;
const FAIL_END_FADE = 0.1;

// The two bottom-corner controls: the call to action on the RIGHT, the mute toggle on the LEFT.
//
// Insets are to each element's CENTRE, so each has to clear its own half-width. The CTA button is
// 197x78, so 120 leaves it about 22 units of margin outside the screen edge; the sound icon is
// 50x50 inside a 76-unit tap target, so 60 leaves its hit box 22 clear as well. Both share a y,
// which is what makes them read as a pair of corners rather than two unrelated widgets.
const CTA_INSET = { x: 120, y: 92 };
const SOUND_INSET = { x: 60, y: 92 };

// The mute button's tap target, in document units, against 50 units of drawn icon. See _buildHud.
const SOUND_HIT = 76;

// The button idle, shared by the download CTA and both end-card buttons — see _pulse for why the
// end cards use the same motion as the CTA rather than something louder of their own.
const BTN_PULSE = 1.06;
const BTN_PULSE_TIME = 0.7;

// FAIL is authored at the full width of the card, and the PSD parks it 3 units left of the
// document centre. Taken down so it does not crowd the TRY AGAIN button, and centred on the
// card rather than on the artboard.
const FAIL_TITLE_SCALE = 0.8;

// How far each light layer swells at the top of its cycle. The broad glows move more than the
// starburst does — a big soft shape can breathe visibly without drawing attention to the fact
// that it is a sprite being scaled, where fine rays start to shimmer.
const RAYS_SWELL = 1.10;
const GLOW_SWELL = 1.16;

// The WIN title, off the size the PSD gives it. It is anchored centre and placed by its box's
// centre, so this shrinks it in place — the extra room opens above and below equally.
const WIN_TITLE_SCALE = 0.8;

// The warm glow, shrunk off its authored 600 px. It has to finish INSIDE the 516 px starburst
// for the starburst to read as the layer in front — including at the top of its own breath, so
// the ceiling is 516/600 = 0.86 divided by GLOW_SWELL. 0.72 leaves a little air under that.
const GLOW_WARM_SCALE = 0.72;

// The ellipse the chest's sparkles spawn in, centred on the ray glow.
//
// Wide, because nothing sits either side of the chest and the glow is only 258 px across, so
// the twinkles can carry past the light. Short, because the WIN title closes to 255 px above
// the centre and the button to 287 px below — less a sparkle's own half-width (~32) and its
// 18 px of upward drift, that caps the vertical at about 205. An ellipse takes the room that
// is actually there instead of settling for the smaller of the two.
const SPARKLE_RX = 310;
const SPARKLE_RY = 195;

// Where the confetti comes in from: just outside the widest thing on the card (the 574 px WIN
// title, so 287 either side), across a tall band so the two sides read as sprays rather than
// as two points.
const CONFETTI_ORIGIN_X = 330;
const CONFETTI_SPAN_Y = 520;

// The stamina meter rides under the hero instead of sitting in a screen corner. It is HIS
// stamina, and it is legible in a glance next to the man it is about — a corner gauge asks the
// player to look away from the thing they are trying to save.
//
// The ceiling on its size is the board, and it is tight. The badge's vertical band (doc y
// 552..654) runs straight down the side of the grid, whose first column starts at x=546, and he
// does not hold still: he is driven left by the pillar (58 units) while the rig stands him
// progressively CLOSER to it as he tires (hero3d's STANDOFF, -8 to +36). Those two nearly
// cancel, but not quite, and the phase standoff eases over 0.3s while push moves at a hundredth
// of that — so the worst frame is push 0.60 with the offset still at 36, and he stands at
// x=492.2. Simulated off the real constants, not guessed.
//
// 0.42 of the PSD's 205 px ring is 86 units, which leaves 10.8 units of daylight between its
// right edge and the first plate. That is also about three quarters of his 118 px width, so it
// reads as his badge rather than as furniture parked near him.
const STAMINA_SCALE = 0.42;

// Air between the ground line and the top of the ring. Its own half-height is added on top —
// see _buildHud, which takes that off the sprite rather than retyping 205 here.
const STAMINA_GAP = 12;

// How close the badge may come to the board. The 10.7 units above are a property of four
// constants in three other files, so this is the backstop for the day one of them is retuned:
// past it the badge stops travelling instead of sliding under a plate. In the game as it stands
// it never fires — it is there so the failure is "the badge lags him by a few units" rather than
// "the badge covers a gem".
const STAMINA_KEEPOUT = 6;

// One colour per exhaustion phase, indexed by hero3d's `phase` — NOT by a threshold of its own.
// Green while he is holding it (idle_0), amber once he is losing ground (idle_1), red when he is
// nearly out (idle_2). Tying the two to one index is the whole point: the badge cannot say he is
// fine while the animation says he is finished.
const STAMINA_COLOR = [0x4ad36a, 0xffc23f, 0xff4b2b];

// What the art looks like where the gauge is empty. Dark rather than transparent, so the ring
// and the arm keep their silhouette against the stone and the waterline stays a clean edge.
const STAMINA_EMPTY = 0x2b3038;

// How long the colour takes to cross to the next phase. Matches hero3d's PHASE_FADE — the pose
// blend and the colour change are the same event, so they travel together.
const STAMINA_TINT_FADE = 0.3;

// The intro camera. He drops into a chamber the player has never seen, and the first thing they
// should read is the MAN — a wide shot of an unfamiliar room asks them to find him in it first.
// So it opens tight on him and pulls back to the playing view once he is on his feet.
//
// 2.0 rather than tighter: at this zoom a portrait phone sees ~360x640 document units, which
// holds the whole of him (he is ~200 tall) plus the ledge under him and the ceiling he came
// through, and pulling back from it still reveals most of the chamber. Tighter starts on a torso.
const INTRO_ZOOM = 2.0;
// Long enough to read as a camera move rather than a cut, and it is dead time before the player
// may act, so it is not free. The board is handed over on its completion.
const INTRO_PULLBACK = 1.0;

// The panic beat — the red frame and the heartbeat, which are ONE timeline and therefore cannot
// drift apart. The period is a property of the clip, not a taste call: heartbeat.mp3 is a single
// lub-dub with its thumps at 0.055s and 0.32s and dead air from 0.885s, so 0.90 is the shortest
// gap that never overlaps its own tail. That is ~67 bpm, and the rate the ear reads is really the
// 0.27s inside the clip anyway. Re-measure these two if the clip is ever re-cut.
const PANIC_BEAT = 0.90;
// The clip's own lead-in — it opens on 55ms of silence, so the frame waits that long before it
// swells and the flash lands ON the first thump instead of just ahead of it.
const PANIC_LEAD = 0.055;

// ...and it runs faster as the last of his ground goes: PANIC_BEAT when the phase begins down to
// this when he is out, ~67bpm to ~97bpm. Applied as a timeScale on the beat timeline, so the
// sound and the frame accelerate as one thing and the beat is never restarted to change tempo.
const PANIC_BEAT_FAST = 0.62;

// The clip is pitched up with the tempo, but only this far. Scaling the pitch by the tempo
// exactly — the obvious move, since then the clip always fits the beat exactly — puts it a fourth
// up at the fast end, which stops sounding like a chest and starts sounding like a bird. Capped
// here instead, which leaves the tail of one beat running ~0.1s into the next; that overlap lands
// in the clip's own last 8%, underneath the following thump, where it cannot be picked out.
//
// The cost of decoupling them is that the flash and the thump drift apart by the difference in
// the two lead-ins, which is 8ms at the fast end. Not a real number on a 60Hz screen.
const PANIC_RATE_MAX = 1.2;

// How loud the thump is, and it is above unity on purpose — a GainNode is a multiplier, not a
// fader with a ceiling at 1.
//
// heartbeat.mp3 is quiet where the rest of the bank is hot: RMS 0.098 against the merge clips'
// 0.24, so at the old 0.55 it landed around -25 dBFS — some 11 dB under the merge and 12 under
// the rockfall, which is buried rather than quiet. 1.3 puts it at about -18, roughly level with
// the merge, and there is headroom for it: the clip PEAKS at only 0.511, so 0.511 x 1.3 x the
// 0.85 master is 0.56 and it is nowhere near clipping even at the top of a beat.
//
// KNOWN LIMIT, on a phone speaker specifically. 97% of this clip's energy is below 120 Hz, which
// is the band a phone driver mostly cannot make — so gain buys much less here than it does on
// headphones, and there is a ceiling on what this constant alone can fix. If it still does not
// carry on a handset, the answer is a re-cut with some upper-mid content in it, or an EQ stage,
// not a bigger number: turning up a frequency the speaker cannot reproduce only spends headroom.
const PANIC_VOLUME = 1.3;
// Where the frame sits at the top of a beat and between beats. It never goes to zero while the
// panic lasts — a frame that blinks off reads as a glitch, where one that breathes reads as him.
const PANIC_ALPHA = 0.85;
const PANIC_REST = 0.3;
// Attack and release. Fast in, because a heartbeat is a hit; slow out over the rest of the beat.
const PANIC_ATTACK = 0.12;
// How long it takes to leave when he is out of danger — long enough to read as relief, and long
// enough that a drain that flickers him across the phase boundary does not strobe the screen.
const PANIC_OFF = 0.45;

// The tutorial glint. It lands on the two gems the hand is asking for, and now and then on some
// other gem, so the board reads as a chamber full of stones catching the light rather than as two
// gems with a UI marker stuck to them. Never more than two alive at once.
//
// Deliberately not on a shared clock with the hand: the cursor runs a 0.95s loop, and a glint
// pulsing in lockstep with it reads as one mechanism blinking. Every spawn re-rolls its cell,
// size, brightness, duration and spin.

// Where it sits, as a fraction of THE GEM'S OWN texture from its centre — the sparkle is a child
// of the gem, so this is in the gem's local space and scales with it.
//
// MEASURED, not chosen: the top 5% brightest pixels of each gem have their centroid at
// (-0.13,-0.29), (-0.28,-0.33) and (-0.29,-0.37) of the sprite for the blue, green and red. All
// three are lit from the upper left, which is the scene's own key at (-0.5, 1, 2). Averaged
// below. The y values agree closely; the x spread is the blue teardrop, whose highlight sits
// nearer its middle because the shape is narrow — the average puts the glint about 4 px left of
// blue's true hotspot on a 37 px gem, which is inside the sparkle's own radius.
const HINT_SPARK_AT = { x: -0.233, y: -0.33 };

// Size as a fraction of a cell — the same cell/64 idiom shine.js uses, since it is the same 64px
// source art. Tops out at about half a cell: bigger and it stops being a glint on the gem and
// starts being a second object sitting next to it.
const HINT_SPARK_MIN = 0.22;
const HINT_SPARK_VAR = 0.26;

// TWO STREAMS, one sprite each, and that is also the cap: stream 0 only ever lights one of the
// two hint gems, stream 1 only ever lights one of the others. Never more than two on the board.
//
// This started as one shared pool with a weighted coin flip deciding hint-or-stray, and the
// strays were reported missing twice. They were not missing — a stray had to win the toss AND
// find a free slot, and losing either put another glint back on the hint pair, so the pair
// crowded out the very thing it was competing with. Dedicating a slot to each removes the
// competition entirely: both streams always run, and the cap is now a property of the pool
// rather than something a coin flip has to be tuned around.
const HINT_SPARK_STREAMS = 2;

// Seconds one lives, and the gap after it DIES before its stream lights another. Chained off the
// death rather than run on a free clock, so a stream can never try to spawn over itself and no
// beat is ever silently dropped. About one of each every 3.5s, drifting in and out of phase.
const HINT_SPARK_LIFE = 2.0;
const HINT_SPARK_GAP = { min: 0.8, max: 2.2 };

// The strays start this much later than the hint pair, so the first thing the player sees is a
// glint on a gem they are being asked to move rather than one somewhere else on the board.
const HINT_SPARK_STRAY_DELAY = 1.2;

// How far one turns over its whole life, in radians, direction picked per spawn. Slow enough that
// it never reads as spinning — it just stops the star landing in the same attitude twice.
//
// shine.js and sparkle.js both hold this art near-upright on the argument that a four-point cross
// wobbles when spun. That argument is about a 0.44s glint; over 2.4s a third of a turn does not
// read as rotation frame to frame.
const HINT_SPARK_TURN = 2.1;

export class Game {
  constructor({ pixiApp, layout, sdk }) {
    this.app = pixiApp;
    this.layout = layout;
    this.sdk = sdk;
    this.state = 'idle';
    this._shake = 0;
    // The camera, in document units. One object for its whole life so it can be tweened; the
    // identity value here is the playing view, so anything that runs before the intro sets it
    // gets the layout exactly as it was before there was a camera at all.
    this._cam = { zoom: 1, x: DOC.width / 2, y: DOC.height / 2 };
    this._camFollow = false;
  }

  async build() {
    this.audio = new Audio();
    // Not awaited: decoding a dozen clips must not hold up first paint, and the context is
    // suspended until a gesture anyway. Anything that fires before it is ready is silent.
    this.audio.init();
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });

    this.scene = await Scene.create();

    this.world = new PIXI.Container();
    this.world.addChild(this.scene.root);
    this.app.stage.addChild(this.world);

    this.hud = new PIXI.Container();
    this.app.stage.addChild(this.hud);

    await PIXI.Assets.load([
      ...['hero_placeholder', 'progressbar', 'arm_icon', 'text_back', 'MERGE_TO_SAVE_HIM',
        'ui_screen_shadow', 'error',
        'HURRY_UP', 'btn', 'DOWNLOAD', 'cursor', 'chest_closed',
        'ui_btn_sound_on', 'ui_btn_sound_off',
        'ui_endcard_ray', 'ui_endcard_ray_glow_2', 'ui_endcard_ray_glow_copy_3',
        'OPEN', 'WIN', 'FAIL', 'btn_1', 'TRY_AGAIN']
        // url(), not layer() — OPEN has no manifest entry and layer() would drop it here too.
        .map((n) => url(n)).filter(Boolean),
    ]);

    this.board = new Board2D({
      stage: this.scene.boardSlot,
      geom: GRID,
      docH: DOC.height,
      onClear: () => this._onCleared(),
      onFirstMove: () => this._onFirstMove(),
      onFlow: (amount) => this._onFlow(amount),
      onSwap: (valid) => this.audio.play(valid ? 'swap' : 'invalid', { volume: valid ? 0.5 : 0.4 }),
      onDrain: () => this.audio.play('drain', { volume: 0.3 }),
    });
    this.board.show();

    const heroArt = layer('hero_placeholder');
    this.hero = new Hero({
      stage: this.scene.heroSlot,
      x: heroArt ? heroArt.x + heroArt.width / 2 : 491,
      footY: heroArt ? heroArt.y + heroArt.height : 540,
      stageW: DOC.width,
      stageH: DOC.height,
      // The spikes have to come out IN FRONT of him, and only his own layer can do that. The rig
      // arrives async, so the scene is handed it the moment it exists rather than asked for it.
      onRig: (rig) => this.scene.liftSpikeTips(rig),
      // The frame his feet hit, which is 0.22s before the drop-in is over. bodyX rather than the
      // x above: the rig stands him off by its own phase offset, and the dust belongs under the
      // man rather than under the mark he was aimed at.
      onImpact: () => this.dust?.burst(this.hero.bodyX, this.hero.footY),
    });
    // Straight onto `world` rather than into one of the scene's slots: it belongs above the whole
    // chamber, and it cannot cover the hero whatever it is parented to, because the rig draws on
    // #three-canvas above all of Pixi. That is the right order — his hands end up over the cut
    // end of the tile, so the rope needs no end cap.
    this.rope = new Rope({ parent: this.world });
    // Also on `world`, and under the same constraint: it draws behind him whatever it is parented
    // to, because the rig owns its own canvas above all of Pixi. Dust behind a man landing is the
    // right way round anyway — it is what he kicked out from under himself.
    this.dust = new Dust({ parent: this.world });

    this._buildHud();
    this._buildOverlays();
    // Already in the cache — board2d's shine emitter loads the same texture — so this resolves
    // immediately and only exists to give the field its Texture handle.
    await Promise.all([
      this.sparkles.load(), this.confetti.load(), this.rope.load(), this.dust.load(),
    ]);
    // After the loads, because it wants the sparkle texture those just put in the cache.
    this._buildHintSpark();
    this.layoutChanged();
    this._enterScene();
  }

  // ---------------- layout ----------------

  layoutChanged() {
    if (!this.world) return;
    const L = this.layout;
    // The world's transform is the camera's, so it is applied in one place for both this and the
    // per-frame follow. The HUD's is NOT: it stays on the plain layout, so an intro zoom moves
    // the chamber without dragging the banner and the CTA off the screen with it.
    this._applyCamera();
    this.hud.scale.set(L.scale);
    this.hud.position.set(L.originX, L.originY);
    // Rubble enters from just above the visible frame and leaves below it, wherever those
    // are for this aspect ratio.
    this.board?.setSpawnY(L.edges.top - 40);
    this.board?.setDrainY(L.edges.bottom + 60);
    this._anchorHud();
  }

  // The camera, onto everything that answers to it. Two things and only two: the Pixi world, and
  // the Three frustum — the Three canvas is stretched over the whole viewport by CSS, so its
  // camera has to be driven from the same rect or the rig only lines up with the painted chamber
  // on a square screen, let alone a zoomed one.
  //
  // Called from layoutChanged on a resize and from update() every frame the camera is moving, so
  // it must stay cheap: no HUD re-anchoring, no board work.
  _applyCamera() {
    const L = this.layout;
    L.setCamera(this._cam.zoom, this._cam.x, this._cam.y);
    this.world.scale.set(L.worldScale);
    // Remembered so the shake can offset from it without fighting the layout.
    this._worldBase = { x: L.worldOriginX, y: L.worldOriginY };
    this.world.position.set(this._worldBase.x, this._worldBase.y);
    this.hero?.setViewport(L);
  }

  // Back to the playing view. Mutates rather than replaces `_cam`, because that object is a gsap
  // tween target during the pull-back and swapping it out from under the tween would leave the
  // tween driving an orphan.
  _camHome() {
    this._cam.zoom = 1;
    this._cam.x = DOC.width / 2;
    this._cam.y = DOC.height / 2;
    this._applyCamera();
  }

  // HUD lives in document units but hangs off the viewport edges, so it stays on screen at
  // any aspect ratio — which is the whole reason those layers were authored off-canvas.
  //
  // The two orientations have their free space in different places, so they get different
  // rules rather than a shared one. In portrait the playfield leaves room above and below;
  // in landscape it fills almost the whole height (visible doc y is ~280..1000 against a
  // playfield of 325..955) and the room is at the sides instead. Anchoring top-centre and
  // bottom-centre in both puts the banner over the hero and the CTA on top of the board.
  // The stamina meter is deliberately absent from this method. It is anchored to the hero, not
  // to a screen edge, and the hero is inside the playfield — which Layout guarantees is fully
  // visible at every aspect ratio (PLAY spans doc y 325..955; the badge sits at ~552..654). So
  // it needs neither a per-orientation position nor a per-orientation scale. See _placeStamina.
  _anchorHud() {
    if (!this.titleGroup) return;
    const L = this.layout;
    const e = L.edges;

    if (L.portrait) {
      this.titleGroup.scale.set(1);
      this._pulse(this.cta, 1);
      this.soundBtn.scale.set(1);

      this.titleGroup.position.copyFrom(L.anchor('center', 'top', 0, 150));
    } else {
      this.titleGroup.scale.set(0.62);
      this._pulse(this.cta, 0.9);
      this.soundBtn.scale.set(0.9);

      // Left gutter for the banner; the bottom corners are shared with portrait below.
      this.titleGroup.position.set(e.left + 180, e.top + 75);
    }

    // The bottom corners are the ONE part of the HUD that does not fork on orientation: both
    // orientations have their free space along the bottom edge, so the same two anchors hold and
    // only the scale differs. Right for the call to action, left for the mute toggle.
    this.cta.position.copyFrom(L.anchor('right', 'bottom', CTA_INSET.x, CTA_INSET.y));
    this.soundBtn.position.copyFrom(L.anchor('left', 'bottom', SOUND_INSET.x, SOUND_INSET.y));

    // Stretched across the full viewport width — a vertical gradient has no horizontal detail
    // to distort — and its authored height scaled with the banner it backs, so it does not eat
    // half the screen in landscape the way a fixed 359 would.
    const shadowBox = box('ui_screen_shadow');
    this.screenShadow.position.set(e.left, e.top);
    this.screenShadow.width = e.right - e.left;
    this.screenShadow.height = (shadowBox?.height ?? 359) * this.titleGroup.scale.y;

    // The panic frame covers the viewport exactly, letterbox and all. Stretched rather than
    // scaled to cover: it is a soft ramp with no feature to distort, and a frame has to meet all
    // four edges — a cover-scaled square would push two of them off screen on any tall phone.
    this.panic.position.set(e.left, e.top);
    this.panic.width = e.right - e.left;
    this.panic.height = e.bottom - e.top;

    this.dim.clear();
    this.dim.rect(e.left, e.top, e.right - e.left, e.bottom - e.top).fill({ color: 0x000000, alpha: 0.62 });
    this.endCard.scale.set(Math.min(1, (e.right - e.left) / CARD_W, (e.bottom - e.top) / CARD_H));
    this.endCard.position.set((e.left + e.right) / 2, (e.top + e.bottom) / 2);
  }

  // A label on a button. Both sprites are centre-anchored, so stacking them at the same point
  // centres the text on the button's BOUNDING BOX — and every button here is a pill with a
  // thick bottom bezel and a drop shadow under it, so the face's optical centre sits well
  // above that. The text ends up looking like it has slid toward the bottom edge.
  //
  // The offset is read back out of the PSD rather than nudged by eye: the layer manifest has
  // both layers' authored positions, and the difference between their centres is exactly the
  // lift the artist gave the label. ~6% of the button height on all three buttons.
  // Offsets a text layer against its button by the difference of their PSD centres, so the
  // label sits exactly where the document puts it. Reads boxes, not art — the CTA button's
  // pixels do not ship, only its placement.
  _label(btnName, textName, parent) {
    return this._labelIn(box(btnName), textName, parent);
  }

  // Same, for a button whose placement does not come from the manifest — see WIN_BTN_BOX.
  // `textBox` overrides the text's manifest box for the same reason.
  _labelIn(b, textName, parent, textBox = null) {
    const s = this._sprite(textName, parent, { boxOverride: textBox });
    const t = textBox ?? box(textName);
    if (b && t) {
      s.x = (t.x + t.width / 2) - (b.x + b.width / 2);
      s.y = (t.y + t.height / 2) - (b.y + b.height / 2);
    }
    return s;
  }

  // `name` gives the box — where it sits and how big it is. `art` gives the pixels, and
  // defaults to the same layer. Splitting the two lets one texture serve two boxes while the
  // PSD still owns both placements.
  //
  // `fromDoc` positions the sprite at its authored place, as an offset from the centre of the
  // 1280-square document. The end cards use it: they are centred on the viewport, and in
  // portrait the visible box IS the full 1280 tall, so a doc-centre offset reproduces the PSD
  // composition exactly. Hand-set offsets were how the win card ended up not matching it.
  _sprite(name, parent, {
    anchorX = 0.5, anchorY = 0.5, art = name, fromDoc = false, boxOverride = null,
  } = {}) {
    // Art by URL, not via layer(): a sprite whose box is supplied here does not need the art to
    // have a manifest entry, and requiring one is what made OPEN draw nothing.
    const u = url(art);
    const b = boxOverride ?? box(name);
    if (!u || !b) return new PIXI.Container();
    const tex = PIXI.Texture.from(u);
    const s = new PIXI.Sprite(tex);
    s.anchor.set(anchorX, anchorY);

    // NEVER above native. The box says how big the design wants this, but a re-export does not
    // always come back at the box's size — WIN returned 562x208 against a 574x220 box — and
    // filling the box regardless would silently upscale it into blur. Clamping at 1 means a
    // smaller export just draws smaller, which is the honest failure. The factor is uniform, so
    // a box with a slightly different aspect cannot squash the art either.
    const k = Math.min(1, b.width / tex.width, b.height / tex.height);
    s.width = tex.width * k;
    s.height = tex.height * k;
    s.alpha = b.opacity ?? 1;
    if (fromDoc) this._placeFromDoc(s, b);
    parent?.addChild(s);
    return s;
  }

  // A light layer swelling and brightening on a loop. Alpha rides the scale — light that grows
  // without getting brighter reads as a sprite being resized — and it rides it off the layer's
  // OWN opacity, which the PSD sets per layer (0.43 / 0.62 / 0.50), so each stays a swell
  // rather than blowing out to full.
  _breathe(node, swell, period) {
    if (!node || node.scale == null) return;
    // Relative to whatever scale the node is already at, not an absolute target — otherwise
    // this silently undoes any sizing done before it.
    const bx = node.scale.x;
    const by = node.scale.y;
    gsap.to(node.scale, {
      x: bx * swell, y: by * swell, duration: period, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
    gsap.to(node, {
      alpha: Math.min(1, (node.alpha ?? 1) * 1.3),
      duration: period,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  // A PSD box as a rect in end-card space (document centre at the origin), optionally shrunk
  // about its own centre.
  _docRect(b, inset = 1) {
    const w = b.width * inset;
    const h = b.height * inset;
    return {
      x: (b.x + b.width / 2) - DOC.width / 2 - w / 2,
      y: (b.y + b.height / 2) - DOC.height / 2 - h / 2,
      width: w,
      height: h,
    };
  }

  // Centre of a PSD box, relative to the centre of the document.
  _placeFromDoc(node, b) {
    node.x = (b.x + b.width / 2) - DOC.width / 2;
    node.y = (b.y + b.height / 2) - DOC.height / 2;
    return node;
  }

  // ---------------- HUD ----------------

  _buildHud() {
    // The screen's top shadow — the PSD's `ui_screen_shadow`, a 1280x359 black gradient parked
    // in the UI group. It is what keeps white text readable over a lit wall, so it goes in
    // FIRST: under the banner's own panel, over everything the world draws.
    //
    // Anchored to the screen's top edge rather than the document's. It is UI, not scenery —
    // and on a viewport the backdrop cannot fill, document y 0 is not the top of anything.
    this.screenShadow = new PIXI.Sprite(PIXI.Texture.from(url('ui_screen_shadow')));
    this.hud.addChild(this.screenShadow);

    // The panic frame. Over the scrim so the warning is not muted by it, under everything else in
    // the HUD so the banner, the gauge and the CTA stay legible through it — which is also why it
    // is the vignette and not a full-screen wash: the middle of the art is transparent, so the
    // board is never tinted and the player can still read the gems they are being warned about.
    this.panic = new PIXI.Sprite(PIXI.Texture.from(url('error')));
    this.panic.visible = false;
    this.panic.alpha = 0;
    this._panic = false;
    this.hud.addChild(this.panic);

    // Title banner
    this.titleGroup = new PIXI.Container();
    this.hud.addChild(this.titleGroup);
    this.textBack = this._sprite('text_back', this.titleGroup);
    this.title = this._sprite('MERGE_TO_SAVE_HIM', this.titleGroup);
    this.hurry = this._sprite('HURRY_UP', this.titleGroup);
    this.hurry.visible = false;

    // Stamina meter — the arm icon in its ring. It reads the same 0..1 the pillar does, so it is
    // a readout of the real threat rather than a second, abstract progress bar.
    //
    // It is parented to the HUD and not to the world on purpose, even though it tracks a thing
    // in the world: the shake moves `world` and does NOT move the rig, which draws on its own
    // canvas off the layout. Sitting in the HUD is what keeps the badge locked to the man
    // through a rockfall instead of sliding out from under his feet.
    this.stamina = new PIXI.Container();
    this.stamina.scale.set(STAMINA_SCALE);
    // Nothing to report before the round starts, so it arrives with the first move.
    this.stamina.visible = false;
    this.stamina.alpha = 0;
    this._staminaOn = false;
    this.hud.addChild(this.stamina);
    this._buildStamina();

    // CTA
    this.cta = new PIXI.Container();
    this.hud.addChild(this.cta);
    // One button, drawn small here: the art ships at the win card's 458x178 so this slot is a
    // 0.43x downscale rather than a blur.
    this._sprite('btn', this.cta);
    this._label('btn', 'DOWNLOAD', this.cta);
    this.cta.eventMode = 'static';
    this.cta.cursor = 'pointer';
    this.cta.on('pointertap', () => this._cta());
    // The CTA's breath is started by _anchorHud, not here: it owns the resting scale, which
    // differs by orientation, and the pulse has to be built on top of that rather than fight it.

    // Mute toggle, opposite corner from the CTA. Two icons, one sprite — the state swaps the
    // texture rather than toggling two sprites' visibility, so there is one thing to place.
    //
    // Not from the manifest: the PSD has no entry for these, so the art is fetched by url() and
    // drawn at its own 50x50. NOT upscaled — `_sprite`'s never-above-native rule applies here
    // too, and a 50px icon stretched to a comfortable thumb is just a blurry icon.
    //
    // The tap target is grown instead, with a hitArea. At 50 document units the icon is about
    // 42 screen px on a phone, under the 44pt floor, and a mute button that takes two attempts
    // is more annoying than no mute button at all.
    this.soundBtn = new PIXI.Container();
    this.hud.addChild(this.soundBtn);
    this.soundIcon = new PIXI.Sprite(PIXI.Texture.from(url('ui_btn_sound_on')));
    this.soundIcon.anchor.set(0.5);
    this.soundBtn.addChild(this.soundIcon);
    this.soundBtn.hitArea = new PIXI.Rectangle(
      -SOUND_HIT / 2, -SOUND_HIT / 2, SOUND_HIT, SOUND_HIT,
    );
    this._muted = false;
    this._makeButton(this.soundBtn, () => this._toggleSound());

    // Tutorial hand. Authored at 139x176 for a decorative pose; over 62px cells that covers
    // four of them, including the pair it is pointing at. Scaled down and anchored near the
    // fingertip so it indicates a cell instead of hiding it.
    this.cursor = this._sprite('cursor', this.hud, { anchorX: 0.28, anchorY: 0.12 });
    this.cursor.scale.set(0.55);
    this.cursor.visible = false;
  }

  // The badge is two copies of each piece of art — an unlit one and a coloured one — with the
  // coloured copy masked down to the fill level. Nothing is redrawn as vector: `progressbar.png`
  // is a thin white ring and `arm_icon.png` a white bicep, so tinting them is exact, and masking
  // the real sprite means the fill matches the artwork's own radius, thickness and antialiasing
  // instead of a Graphics approximation of it that would have to be remeasured on every export.
  //
  // Both readouts carry the same number on purpose. The ring unwinds and the arm drains, so the
  // gauge is legible from either half at 86 document units, where a single thin arc is not.
  _buildStamina() {
    const s = this.stamina;

    // Order is the draw order: unlit ring, lit ring, unlit arm, lit arm. The arm sits inside the
    // ring, so it goes last and the ring never crosses it.
    const ringTrack = this._sprite('progressbar', s);
    this.staminaRing = this._sprite('progressbar', s);
    const armTrack = this._sprite('arm_icon', s);
    this.staminaArm = this._sprite('arm_icon', s);

    ringTrack.tint = STAMINA_EMPTY;
    armTrack.tint = STAMINA_EMPTY;

    // A pie wedge for the ring and a rising waterline for the arm. Masks have to be in the
    // display list to inherit the container's transform, so they are added as children — they
    // draw nothing themselves.
    this.staminaRingMask = new PIXI.Graphics();
    this.staminaArmMask = new PIXI.Graphics();
    s.addChild(this.staminaRingMask, this.staminaArmMask);
    this.staminaRing.mask = this.staminaRingMask;
    this.staminaArm.mask = this.staminaArmMask;

    // Geometry, taken off the sprites rather than retyped, so a re-export at another size still
    // lands 12 units under his feet, still stops short of the same plate, and still masks to its
    // own edges. `_sprite` hands back a bare Container when the art is missing — hence `|| `.
    this._ringR = ((ringTrack.width || 205) / 2) * 1.05;   // a hair proud of the ring, so the
    this._armH = armTrack.height || 132;                   // wedge's edge never clips it
    this._armW = armTrack.width || 130;
    const ringW = (ringTrack.width || 205) * STAMINA_SCALE;
    this._staminaDrop = STAMINA_GAP + ((ringTrack.height || 205) * STAMINA_SCALE) / 2;
    this._staminaMaxX = GRID.originX - STAMINA_KEEPOUT - ringW / 2;

    // Current colour, eased toward the phase's. Held as three channels because that is what can
    // be interpolated — a packed hex cannot.
    this._tint = { r: 0, g: 0, b: 0 };
    this._setTint(STAMINA_COLOR[0], true);
  }

  // Under his feet, following him. He is braced against the pillar and travels with it, and the
  // rig stands him off by its own phase offset on top of that — `bodyX` is the only number that
  // has both, which is why this cannot just read the spot he was placed at.
  //
  // Called every frame rather than tweened: he is driven by the pillar, per frame, so anything
  // easing toward him would lag behind his own motion and read as the badge sliding around.
  _placeStamina() {
    if (!this.stamina.visible) return;
    const x = Math.min(this.hero.bodyX, this._staminaMaxX);
    this.stamina.position.set(x, this.hero.footY + this._staminaDrop);
  }

  // The meter belongs to the ROUND, not to the screen. It is not there while the player is still
  // reading the instruction — there is no pressure to report yet, and an empty gauge on the title
  // beat is one more thing competing with the one message that matters — and it leaves again with
  // the round. Edge-triggered on a flag, so calling it every frame would be free if anything did.
  _showStamina(show, { instant = false } = {}) {
    const s = this.stamina;
    if (!s || (show === this._staminaOn && !instant)) return;
    this._staminaOn = show;
    gsap.killTweensOf([s, s.scale]);

    if (!show) {
      if (instant) {
        s.visible = false;
        s.alpha = 0;
        s.scale.set(STAMINA_SCALE);
        return;
      }
      gsap.to(s, { alpha: 0, duration: 0.25, onComplete: () => { s.visible = false; } });
      return;
    }

    s.visible = true;
    s.alpha = 0;
    // Placed AND drawn before the pop, because this is called from a board callback rather than
    // from update(): without the place, the first frame happens at wherever he stood last round;
    // without the draw, it happens with empty masks, which is a badge with nothing lit in it.
    // The colour is snapped rather than eased so a retry does not open in the red it ended on.
    this._placeStamina();
    this._setTint(STAMINA_COLOR[this.hero.fatiguePhase ?? 0], true);
    this._drawStamina(0);
    s.scale.set(STAMINA_SCALE * 0.7);
    gsap.to(s, { alpha: 1, duration: 0.25 });
    gsap.to(s.scale, { x: STAMINA_SCALE, y: STAMINA_SCALE, duration: 0.45, ease: 'back.out(2)' });
  }

  // Eases the badge's colour toward `hex`. Per-frame exponential rather than a tween, so it is
  // frame-rate independent and cannot be left half-applied by a retry killing tweens.
  _setTint(hex, instant = false, k = 1) {
    const t = this._tint;
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    if (instant) { t.r = r; t.g = g; t.b = b; } else {
      t.r += (r - t.r) * k;
      t.g += (g - t.g) * k;
      t.b += (b - t.b) * k;
    }
    const packed = (Math.round(t.r) << 16) | (Math.round(t.g) << 8) | Math.round(t.b);
    this.staminaRing.tint = packed;
    this.staminaArm.tint = packed;
  }

  _drawStamina(dt) {
    // Nothing to rebuild while it is off screen, which is the whole intro and both end cards.
    if (!this.stamina.visible) return;

    // Ground he has left before the spikes, not the weight on him this instant — so the gauge
    // drains monotonically as he loses and visibly refills when a drain gives him ground back.
    const left = 1 - (this.board?.push ?? 0);

    // COLOUR IS THE POSE. Not a second set of thresholds on the same number — the rig's own
    // phase index, so the ring turns amber on the exact frame he drops into idle_1 and red on
    // the frame he drops into idle_2, hysteresis and all. See the `fatiguePhase` getter, which
    // is also what the grunt and the panic frame read.
    const phase = this.fatiguePhase;
    // Eased over the same 0.3s the rig cross-fades the pose over, so the colour arrives with the
    // animation rather than snapping ahead of it.
    this._setTint(STAMINA_COLOR[phase], false, Math.min(1, dt / STAMINA_TINT_FADE));

    // The ring unwinds CLOCKWISE — masking the shipped ring sprite rather than stroking an arc,
    // so the lit part is the artwork itself.
    //
    // Twelve o'clock is the fixed END of the wedge, not its start, and that is the whole trick.
    // Sweeping the other way round draws a wedge that is itself clockwise from twelve, but the
    // only edge that MOVES is the far one, and as the gauge drains that edge retreats 12 -> 9 ->
    // 6 -> 3: anticlockwise, which is what the eye actually follows. Anchoring the end instead
    // leaves the moving edge running 12 -> 3 -> 6 -> 9, the way a clock does.
    //
    // At left = 1 the two angles are exactly 2*PI apart, which is the case canvas draws as a full
    // circle rather than as nothing — same as it was before, just mirrored.
    const m = this.staminaRingMask;
    m.clear();
    if (left > 0) {
      const r = this._ringR;
      m.moveTo(0, 0)
        .arc(0, 0, r, -Math.PI / 2 - Math.PI * 2 * left, -Math.PI / 2)
        .lineTo(0, 0)
        .fill(0xffffff);
    }

    // ...and the arm drains to a waterline. Rect from the fill level down past the bottom edge.
    const a = this.staminaArmMask;
    const h = this._armH;
    const w = this._armW;
    a.clear();
    if (left > 0) a.rect(-w / 2, h / 2 - h * left, w, h * left).fill(0xffffff);
  }

  // ---------------- overlays ----------------

  _buildOverlays() {
    this.overlay = new PIXI.Container();
    this.overlay.visible = false;
    this.hud.addChild(this.overlay);

    // The scrim doubles as the win card's hit target: on that card the WHOLE screen takes the
    // player to the store, not just the OPEN button. It already covers exactly the visible box —
    // _anchorHud redraws it from Layout.edges on every resize — so it is the one node that is
    // guaranteed to be the right shape without a second rect to keep in step.
    //
    // Left off by default and switched per card in _showEnd, because it must NOT be live on the
    // fail card: there the one thing to tap is TRY AGAIN, and a full-screen CTA under it would
    // send anyone who missed the button to the store instead of back into the game.
    this.dim = new PIXI.Graphics();
    this.dim.eventMode = 'none';
    this.dim.on('pointertap', () => this._cta());
    this.overlay.addChild(this.dim);

    this.endCard = new PIXI.Container();
    this.overlay.addChild(this.endCard);

    this.winGroup = new PIXI.Container();
    this.endCard.addChild(this.winGroup);
    // Every piece is placed from the PSD. Added in the document's own bottom-to-top order, so
    // z-order comes from the design too rather than from the order someone typed them in.
    // Three layers of light. ORDER IS THE ADD ORDER — broad additive glow, warm glow, then the
    // starburst last so it sits in front of both.
    //
    // The starburst was already added last, but it did not read that way: the warm glow is
    // 600 px against its 516, so it spilled past the rays on every side and looked like the top
    // layer. Depth here is as much about relative size as z-order, hence GLOW_WARM_SCALE below.
    //
    // The additive one is LINEAR DODGE in the document. Compositing it normally is not a small
    // difference — it is the difference between light and a grey disc laid over the art.
    const glowAdd = this._sprite('ui_endcard_ray_glow_2', this.winGroup, { fromDoc: true });
    glowAdd.blendMode = 'add';
    const glowWarm = this._sprite('ui_endcard_ray_glow_copy_3', this.winGroup, { fromDoc: true });
    glowWarm.scale.set(GLOW_WARM_SCALE);
    this.rays = this._sprite('ui_endcard_ray', this.winGroup, { fromDoc: true });

    // All three breathe, at different periods and slightly different amounts. Matching periods
    // would collapse them into one stiff pulse; staggered, the light seems to move within
    // itself. Each is slower than the chest's ~2.1s hop so nothing beats in time with it.
    this._breathe(glowWarm, GLOW_SWELL, 3.4);
    this._breathe(glowAdd, GLOW_SWELL * 0.7, 2.9);
    this._breathe(this.rays, RAYS_SWELL, 2.6);
    // The chest lures rather than sits, and it stands on the BOTTOM of its PSD box rather than
    // hanging from the centre — the hop and the squash both work off that floor.
    const cb = box('chest_closed');
    this.chest = new Chest({
      parent: this.winGroup,
      cx: (cb.x + cb.width / 2) - DOC.width / 2,
      cy: (cb.y + cb.height) - DOC.height / 2,
    });
    this.winTitle = this._sprite('WIN', this.winGroup, { fromDoc: true });
    // Multiplied rather than assigned, so it stays a reduction off whatever _sprite settled on
    // and cannot quietly cancel that method's no-upscale clamp.
    this.winTitle.scale.set(this.winTitle.scale.x * WIN_TITLE_SCALE);
    this.winBtn = new PIXI.Container();
    this.winGroup.addChild(this.winBtn);
    // The button is exported at exactly this size, so it draws 1:1 here and the CTA is the one
    // that scales down.
    const wb = new PIXI.Sprite(PIXI.Texture.from(layer('btn').url));
    wb.anchor.set(0.5);
    wb.width = WIN_BTN_BOX.width;
    wb.height = WIN_BTN_BOX.height;
    this.winBtn.addChild(wb);
    this._labelIn(WIN_BTN_BOX, 'OPEN', this.winBtn, OPEN_BOX);
    this._placeFromDoc(this.winBtn, WIN_BTN_BOX);
    this._makeButton(this.winBtn, () => this._cta());

    // Added last so the light falls over everything, including the button. The chest is
    // weighted heaviest — it is the prize, and the other two are there so the glint carries
    // across the whole card instead of pooling in one spot. Regions are inset slightly so
    // sparkles land ON the art rather than around its bounding box.
    // The chest only. The title and the button had their own spawn regions for a while and it
    // was wrong twice over: it put glints on top of the two things the player has to read, and
    // it spread a fixed budget of sparkles thin. All of it belongs around the prize.
    const rb = box('ui_endcard_ray');
    this.sparkles = new SparkleField({
      parent: this.winGroup,
      regions: [{
        cx: (rb.x + rb.width / 2) - DOC.width / 2,
        cy: (rb.y + rb.height / 2) - DOC.height / 2,
        rx: SPARKLE_RX,
        ry: SPARKLE_RY,
      }],
    });

    // Thrown in from off both edges of the card, so the pieces are already moving when they
    // arrive rather than appearing at the boundary. Last in the group: confetti passes in front
    // of everything, including the button.
    this.confetti = new Confetti({
      parent: this.winGroup,
      originX: CONFETTI_ORIGIN_X,
      spanY: CONFETTI_SPAN_Y,
    });

    this.failGroup = new PIXI.Container();
    this.endCard.addChild(this.failGroup);
    const failTitle = this._sprite('FAIL', this.failGroup, { fromDoc: true });
    // Scaled off whatever _sprite settled on rather than set outright — it clamps to the art's
    // native size, and overwriting that would silently upscale a smaller re-export.
    failTitle.scale.set(failTitle.scale.x * FAIL_TITLE_SCALE, failTitle.scale.y * FAIL_TITLE_SCALE);
    failTitle.x = 0;
    this.failBtn = new PIXI.Container();
    this.failGroup.addChild(this.failBtn);
    this._sprite('btn_1', this.failBtn);
    this._label('btn_1', 'TRY_AGAIN', this.failBtn);
    this._placeFromDoc(this.failBtn, box('btn_1'));
    this._makeButton(this.failBtn, () => this.reset());
  }

  _makeButton(container, onTap) {
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onTap);
  }

  // The one button idle in the game: the download CTA and both end-card buttons breathe, and they
  // breathe identically.
  //
  // This replaced a squash-and-hop on the end cards. The hop was wrong, and not because it was
  // badly tuned — a button that jumps reads as a fourth thing happening on a card where the group
  // is already springing in, the rays are turning and the confetti is falling. A breath sits under
  // all of that and still says "press me". It is also the motion the player has been looking at
  // for the whole round, so the end card asks in a language they already know.
  //
  // Scale only, and self-restoring: a yoyo returns the button to 1 at the end of every cycle, so
  // an interrupted pulse cannot leave the button parked at the wrong size the way an interrupted
  // hop left it squashed and sitting high.
  // `base` is the scale the button rests at; the breath is a multiple of it, not an absolute.
  // That distinction is load-bearing for the CTA, which _anchorHud sizes at 0.9 in landscape: an
  // absolute tween to 1.06 overwrites that on the next frame AND yoyos back to whatever the scale
  // happened to be when the tween was created, so the landscape size never survived first contact.
  _pulse(btn, base = 1) {
    if (!btn) return null;
    this._stopPulse(btn);
    btn._pulseBase = base;
    btn.scale.set(base);
    btn._pulseTw = gsap.to(btn.scale, {
      x: base * BTN_PULSE,
      y: base * BTN_PULSE,
      duration: BTN_PULSE_TIME,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    return btn._pulseTw;
  }

  _stopPulse(btn) {
    if (!btn) return;
    btn._pulseTw?.kill();
    btn._pulseTw = null;
    gsap.killTweensOf(btn.scale);
    btn.scale.set(btn._pulseBase ?? 1);
  }

  // ---------------- flow ----------------

  // He falls in through the slot in the ceiling, and the chamber closes behind him. The beam is
  // not awaited — it is scenery, and holding the board disabled for another half second while a
  // slab slides shut would cost more than the beat is worth.
  _enterScene() {
    this.state = 'intro';
    this.overlay.visible = false;
    this.hurry.visible = false;
    this.board.enabled = false;

    // Tight on him, and tracking, before the first frame is drawn — not tweened in from the wide
    // shot, which would show the room first and throw away the point of opening close.
    //
    // He starts a body's height ABOVE the document, so this is only nominally "on him" for the
    // first moments: Layout's clamp holds the camera against the ceiling until he falls into
    // frame. That is the intended shot rather than a compromise — it opens on the hole he is
    // about to come through — and it is why the follow needs no special case for the fall.
    this._cam.zoom = INTRO_ZOOM;
    this._camFollow = true;
    this._applyCamera();

    this.scene.openCeiling();
    this.hero.dropIn().then(() => {
      this._sealCeiling();
      // He is on his feet; the camera stops chasing and gives the room back. _resetState — which
      // hands the board over and starts the tutorial hand — waits for the move to finish, because
      // a hint pointing at gems that are still off the bottom of the screen teaches nothing.
      this._camFollow = false;
      gsap.to(this._cam, {
        zoom: 1,
        x: DOC.width / 2,
        y: DOC.height / 2,
        duration: INTRO_PULLBACK,
        ease: 'power2.inOut',
        onUpdate: () => this._applyCamera(),
        onComplete: () => this._resetState(),
      });
    });
  }

  // Two sounds, because it is two events: stone grinding out of the wall, then the slab landing
  // home. The shake is on the landing, not the slide.
  _sealCeiling() {
    this.audio.play('door', { volume: 0.5 });
    return this.scene.sealCeiling().then(() => {
      this.audio.play('plate', { volume: 0.45 });
      this._shake = 0.35;
    });
  }

  _resetState() {
    this.state = 'idle';
    this.board.enabled = true;
    this.overlay.visible = false;
    // Back with the board. Killed first, or a retry landing mid-fade hands the tween a target
    // it will keep driving to zero.
    gsap.killTweensOf(this.cta);
    this.cta.visible = true;
    this.cta.alpha = 1;
    // Back with it — same reason, same hazard: a retry landing mid-fade would hand the tween a
    // target it keeps driving to zero.
    gsap.killTweensOf(this.soundBtn);
    this.soundBtn.visible = true;
    this.soundBtn.alpha = 1;
    this.hurry.visible = false;
    this.title.visible = true;
    gsap.killTweensOf(this.titleGroup);
    this.titleGroup.alpha = 1;
    this._banner = true;
    // The cards are gone, so their buttons stop hopping. Restored to their resting pose too, or
    // a retry taken mid-hop leaves that button squashed and sitting high next time it is shown.
    this._stopPulse(this.winBtn);
    this._stopPulse(this.failBtn);
    // A retry starts him fresh, so the phase the last round ended on must not be carried in —
    // otherwise the first real phase loss of the new round is not an edge and goes unheard.
    this._fatiguePhase = 0;
    this._setPanic(false);
    // The camera is home by the time a round starts, on both paths into here: the intro calls
    // this from the end of its pull-back, and a retry has no drop-in to follow, so it snaps.
    // Killed first, or a retry landing mid-pull-back leaves that tween driving the camera back
    // out to a zoom the new round never asked for.
    this._camFollow = false;
    gsap.killTweensOf(this._cam);
    this._camHome();
    // Instant, not faded: a retry can land mid-fade, and a tween running toward the value this
    // is setting would drive it straight back the other way.
    this._showStamina(false, { instant: true });
    this._startHint();
  }

  // The instruction banner — panel and text together. It is only true before the player has
  // acted on it, so it leaves when they do, and the panel comes back only to carry HURRY.
  // Edge-triggered: update() calls this every frame, and re-tweening alpha to the value it is
  // already heading for would pin it at its starting point.
  _showBanner(show) {
    if (show === this._banner) return;
    this._banner = show;
    gsap.killTweensOf(this.titleGroup);
    gsap.to(this.titleGroup, { alpha: show ? 1 : 0, duration: show ? 0.25 : 0.45 });
  }

  // Restart the round.
  //
  // RE-ENTRANT BY CONSTRUCTION, which is what the guard is for. The last line calls
  // `sdk.retry()`, and that is not the notification it reads as: @smoud/playable-sdk's `retry()`
  // is `emitEvent("retry")`, which dispatches SYNCHRONOUSLY to every registered listener. main.js
  // registers exactly one —
  //
  //     sdk.on('retry', () => game.reset());
  //
  // — so reset() ends by calling reset(), for ever. The page freezes with the music still playing,
  // because Web Audio is on its own thread and does not care that the main one is gone.
  //
  // Two lines in two files, each correct alone, and both present since the first commit. It lay
  // dormant because the SDK never finished initialising until vite.config gained its `define`
  // block, and an SDK that never initialised has no listeners to dispatch to. Wiring up the CTA
  // is what armed it, which is why this broke a long way from where it was introduced.
  //
  // Neither call may simply be deleted: the player's TRY AGAIN comes in here and the network does
  // want telling, and the network's own replay button emits `retry` and the game does have to
  // restart. So the second entry is made a no-op instead. A plain flag is sufficient precisely
  // BECAUSE the dispatch is synchronous — the re-entry always arrives while this call is still on
  // the stack. If the SDK ever defers its emit, this guard stops working and the cycle is back.
  reset() {
    if (this._resetting) return;
    this._resetting = true;
    try {
      gsap.killTweensOf(this.cursor);
      this.board.reset();
      this.hero.place();
      // Before setPush, which is a no-op while the pillar is down — a retry after a win would
      // otherwise start the round with no pillar and the shaft wall still opened out to where its
      // rubble was.
      this.scene.restorePillar();
      this.scene.restoreTrap();
      this.scene.setPush(0);
      this._setDanger(false);
      this.audio.duckMusic(false);
      this.audio.duckDebris(false);
      this.winGroup.visible = false;
      this.failGroup.visible = false;
      this.chest.reset();
      this.sparkles.reset();
      this.confetti.reset();
      this.rope.reset();
      // A retry snaps him back onto his mark rather than dropping him again, so there is no impact
      // to raise dust — but a retry taken during the first second of a round can land while the
      // last one's is still in the air.
      this.dust.reset();
      this._resetState();
      try { this.sdk?.retry?.(); } catch (e) {}
    } finally {
      // In a finally, so a throw anywhere above cannot leave the game permanently unable to retry.
      this._resetting = false;
    }
  }

  _onFirstMove() {
    if (this.state !== 'idle') return;
    this.state = 'play';
    this._hideHint();
    this._showBanner(false);  // they have understood it; the screen is better off without it
    // ...and the gauge takes its place, on the same beat the threat clock starts. It reports the
    // pillar, so it appears exactly when the pillar starts moving.
    this._showStamina(true);
    this.board.startInflow(); // the threat clock starts when the player does
    try { this.sdk?.start?.(); } catch (e) {}
  }

  // Chip FX are spawned by the board, which owns the cell positions. This is the audio half.
  _onCleared() {
    this.audio.playMatch();               // the gems merging, one rung up the ladder each time
    // ...and the stone letting go under them, a beat later, because that is when it does:
    // the plate only starts to crumble once the gem has finished shrinking (T_CLEAR).
    gsap.delayedCall(0.16, () => this.audio.play('plate', { volume: 0.3 }));
  }

  // Edge-triggered: the loop's gain is ramped, so calling this every frame would restart the
  // ramp every frame and hold it at its starting value forever.
  _setDanger(on) {
    if (on === this._danger) return;
    this._danger = on;
    this.audio.setDanger(on);
  }

  // How far gone he is, as 0/1/2. The RIG's own phase index, hysteresis and all, so the pose, the
  // ring's colour, the grunt and the red frame are one event by construction rather than four
  // thresholds that have to be kept in step by hand. A build with no rig has no poses to sync to
  // and falls back to the midpoints of hero3d's up/down bands.
  get fatiguePhase() {
    const p = this.hero?.fatiguePhase;
    if (p != null) return p;
    const left = 1 - (this.board?.push ?? 0);
    return left > 0.685 ? 0 : left > 0.36 ? 1 : 2;
  }

  // The last phase, as one beat: the red frame swells and the heart thumps together, off a single
  // repeating timeline. Two clocks would be two clocks — a `repeat: -1` tween for the frame and a
  // delayedCall chain for the sound start together and are visibly apart within a few beats,
  // because nothing keeps a gsap repeat and a re-scheduled callback on the same frame.
  //
  // Edge-triggered for the same reason _setDanger is: this builds a timeline, and calling it every
  // frame would rebuild it every frame and hold it at its first value forever.
  _setPanic(on) {
    if (on === this._panic) return;
    this._panic = on;

    this._panicTl?.kill();
    this._panicTl = null;
    gsap.killTweensOf(this.panic);

    if (!on) {
      gsap.to(this.panic, {
        alpha: 0,
        duration: PANIC_OFF,
        ease: 'power2.out',
        onComplete: () => { this.panic.visible = false; },
      });
      return;
    }

    this.panic.visible = true;
    // The ground he has left at the moment the phase begins, so the tempo ramp calibrates itself
    // against the real boundary instead of carrying a copy of hero3d's PHASE_UP here — a copy
    // that would quietly stop matching the first time the poses were retuned. Re-entry after a
    // drain recalibrates, which is correct: the ramp is "from here to empty", wherever here is.
    this._panicFrom = Math.max(0.05, 1 - (this.board?.push ?? 0));
    this._panicRate = 1;
    this._panicTl = gsap.timeline({ repeat: -1 })
      // Reads _panicRate at fire time, not at build time, so the pitch follows the tempo without
      // the timeline ever being rebuilt.
      .call(() => this.audio.play('heartbeat', { volume: PANIC_VOLUME, rate: this._panicRate }))
      // Placed at PANIC_LEAD rather than appended, so the swell is aligned to the clip's first
      // thump; the release then runs out whatever is left of the beat.
      .to(this.panic, { alpha: PANIC_ALPHA, duration: PANIC_ATTACK, ease: 'power2.out' }, PANIC_LEAD)
      .to(this.panic, {
        alpha: PANIC_REST,
        duration: PANIC_BEAT - PANIC_ATTACK - PANIC_LEAD,
        ease: 'power2.out',
      });
  }

  // The heart speeding up. `left` is the ground he has, the same number the gauge draws.
  //
  // timeScale on the running timeline rather than a rebuilt one: the tempo changes every frame,
  // and rebuilding would restart the beat every frame — the heart would never get past its first
  // thump. This way the current beat compresses smoothly under the new rate, which is what
  // accelerating sounds like.
  _setPanicTempo(left) {
    if (!this._panicTl) return;
    const t = Math.min(1, Math.max(0, 1 - left / this._panicFrom));
    const period = PANIC_BEAT + (PANIC_BEAT_FAST - PANIC_BEAT) * t;
    this._panicTl.timeScale(PANIC_BEAT / period);
    this._panicRate = 1 + (PANIC_RATE_MAX - 1) * t;
  }

  // Fires when a mass of rubble is genuinely pouring, not per rock impact. Mass is sold by
  // the screen reacting to it — a pile that slides silently past a static camera reads as
  // polystyrene however good the simulation underneath is.
  _onFlow(amount) {
    this.audio.setFlow(amount);
    this._shake = Math.min(1, 0.35 + amount / 60);
  }

  _applyShake(dt) {
    const base = this._worldBase;
    if (!base) return;
    if (this._shake <= 0) {
      this.world.position.set(base.x, base.y);
      return;
    }
    this._shake = Math.max(0, this._shake - dt * 2.2);   // ~0.5s decay
    // worldScale, so a shake is the same size on screen whatever the camera is doing.
    const mag = 7 * this.layout.worldScale * this._shake * this._shake; // ease out sharply
    this.world.position.set(
      base.x + (Math.random() - 0.5) * mag,
      base.y + (Math.random() - 0.5) * mag,
    );
  }

  // ---------------- tutorial ----------------

  // Dim everything but the pair worth swapping, and run the hand over it. This is the whole
  // answer to "the player should understand what to do within the first few seconds".
  _startHint() {
    const cells = this.board.hintCells();
    if (cells.length < 2) return;
    this.board.showHint();

    const a = { x: this.board.cellX(cells[0].c), y: this.board.cellY(cells[0].r) };
    const b = { x: this.board.cellX(cells[1].c), y: this.board.cellY(cells[1].r) };
    this.cursor.visible = true;
    this.cursor.alpha = 1;

    // Both hint cells, so the glint moves between the two gems the swap involves rather than
    // marking one of them. Cell coordinates, not pixels — _sparkOne resolves them itself, and it
    // has to pick from the live board as well.
    if (this._sparks) {
      // A retry can reach here with one still fading from the last round, riding a gem the
      // rebuild has already moved, and with its stream's next call already queued.
      for (const c of this._sparkCalls) c?.kill();
      for (let i = 0; i < this._sparks.length; i++) {
        gsap.killTweensOf([this._sparks[i], this._sparkState[i]]);
        this._sparks[i].visible = false;
        this._sparkState[i].gem = null;
      }
      this._hintCells = cells;
      this._hintOn = true;
      // The hint pair fires immediately — a tutorial that opens on two seconds of nothing has
      // missed its moment — and the strays come in behind it. From here each stream chains off
      // its own sparkle's death.
      this._sparkAgain(0, 0);
      for (let i = 1; i < HINT_SPARK_STREAMS; i++) this._sparkAgain(i, HINT_SPARK_STRAY_DELAY);
    }

    // The hand lives in the HUD container and the cells in the world container, but both
    // share the same scale and origin, so document coordinates carry across unchanged.
    const from = a;
    const to = b;
    this.cursor.position.set(from.x, from.y);
    gsap.killTweensOf(this.cursor);
    gsap.timeline({ repeat: -1, repeatDelay: 0.4 })
      .set(this.cursor, { x: from.x, y: from.y, alpha: 1 })
      .to(this.cursor, { x: to.x, y: to.y, duration: 0.7, ease: 'power2.inOut' })
      .to(this.cursor, { alpha: 0, duration: 0.25 });
  }

  // The glint's pool, on `world` rather than in the HUD where the cursor lives. Two reasons: the
  // shake moves `world` and not the HUD, and these are stuck to gems where the hand only points
  // at one; and `world` is above the whole chamber, so a glint on the board's first column is not
  // hidden by the pillar, which overlaps it.
  _buildHintSpark() {
    // The sparkles live here for good and FOLLOW their gem per frame — see _followSparks. They
    // are not parented to it, though that is the obvious way to make a glint ride a gem's pulse
    // and it is what this did first. PIXI v8 sets `allowChildren = false` on Sprite (and on every
    // other ViewContainer: Graphics, Mesh, Text), so `gem.addChild(sparkle)` lands in a
    // deprecation path — "Only Containers will be allowed to add children in v8.0.0" — and the
    // child does not draw. The gems are Sprites, so nothing appeared.
    //
    // Following costs two multiplies a frame and works on a supported scene graph.
    const layer = new PIXI.Container();
    // On the container — light adds to what is under it, and a white sprite laid over a gem reads
    // as a sticker. Set once here so the pool stays in a single draw call, as shine.js does.
    layer.blendMode = 'add';
    this.world.addChild(layer);
    this.hintSparkLayer = layer;

    // Fixed pool, sized to the cap: there is no path by which a third could be wanted, so the
    // cap is a property of the pool rather than a counter that has to be kept in step with it.
    this._sparks = [];
    this._sparkCalls = [];
    // One state record per stream: the gem it is riding, its offset in that gem's local pixels,
    // and `k`, its own scale before the gem's is folded in. `k` is tweened rather than the
    // sprite's scale directly, because _followSparks overwrites the sprite's scale every frame
    // and a tween driving the same property would be undone on the next tick.
    this._sparkState = [];
    for (let i = 0; i < HINT_SPARK_STREAMS; i++) {
      const s = new PIXI.Sprite(PIXI.Texture.from(VFX_SPARKLE_URL));
      s.anchor.set(0.5);
      s.visible = false;
      layer.addChild(s);
      this._sparks.push(s);
      this._sparkState.push({ gem: null, k: 0, ox: 0, oy: 0 });
    }
    // Cell-relative, like shine.js — the art is 64px standing in for a highlight, so it has to be
    // sized against the board rather than against the screen.
    this._sparkBase = ((GRID.cellW + GRID.cellH) / 2) / 64;
    this._hintOn = false;
  }

  // Schedules stream `i`'s next glint. Every path out of a sparkle comes back through here, so a
  // stream is a chain rather than a clock and can never stack two on one sprite.
  _sparkAgain(i, delay) {
    this._sparkCalls[i]?.kill();
    this._sparkCalls[i] = gsap.delayedCall(delay, () => this._sparkOne(i));
  }

  _sparkGap() {
    return HINT_SPARK_GAP.min + Math.random() * (HINT_SPARK_GAP.max - HINT_SPARK_GAP.min);
  }

  // Stream 0 lights the hint pair, every other stream lights anything else on the board. The two
  // hint cells are filtered OUT of the stray pool rather than left in it, or the strays would
  // keep landing back on the gems stream 0 already covers.
  _sparkCell(i) {
    const hint = this._hintCells ?? [];
    if (i === 0) return hint.length ? hint[(Math.random() * hint.length) | 0] : null;
    const pool = this.board.liveCells()
      .filter((p) => !hint.some((h) => h.r === p.r && h.c === p.c));
    return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
  }

  _sparkOne(i) {
    if (!this._hintOn) return;
    const s = this._sparks[i];
    const cell = this._sparkCell(i);
    const gem = cell && this.board.gemSprite(cell.r, cell.c);
    // No gem to light this time round — the board can be mid-cascade. Try again on the next beat
    // rather than letting the stream die quietly.
    if (!gem) { this._sparkAgain(i, this._sparkGap()); return; }

    // The offset is in the GEM'S local pixels — its own texture, centred on its anchor — so the
    // glint lands on that gem's highlight whatever shape it is. _followSparks scales it by the
    // gem's own scale each frame, which is what makes it ride the hint pulse.
    const st = this._sparkState[i];
    st.gem = gem;
    st.ox = (gem.texture?.width ?? GRID.cellW) * HINT_SPARK_AT.x;
    st.oy = (gem.texture?.height ?? GRID.cellH) * HINT_SPARK_AT.y;
    st.k = 0;

    s.visible = true;
    s.alpha = 0;
    s.rotation = Math.random() * Math.PI * 2;
    // Placed before it can be drawn, or the first frame is at last round's gem.
    this._followSpark(i);

    const k = this._sparkBase * (HINT_SPARK_MIN + Math.random() * HINT_SPARK_VAR);
    const life = HINT_SPARK_LIFE * (0.8 + Math.random() * 0.4);
    const dir = Math.random() < 0.5 ? -1 : 1;

    // Symmetric in and out, like sparkle.js and unlike shine.js's hard punch: nothing struck this
    // one, it catches the light and loses it again.
    gsap.to(st, { k, duration: life * 0.45, ease: 'sine.out' });
    gsap.to(st, { k: k * 0.1, duration: life * 0.55, delay: life * 0.45, ease: 'sine.in' });
    gsap.to(s, { alpha: 0.55 + Math.random() * 0.45, duration: life * 0.4, ease: 'sine.out' });
    gsap.to(s, { rotation: s.rotation + dir * HINT_SPARK_TURN, duration: life, ease: 'sine.inOut' });
    gsap.to(s, {
      alpha: 0,
      duration: life * 0.5,
      delay: life * 0.5,
      ease: 'sine.in',
      // Letting go of the gem is what ends the follow; then the stream books its next glint.
      onComplete: () => {
        s.visible = false;
        st.gem = null;
        this._sparkAgain(i, this._sparkGap());
      },
    });
  }

  // Copies each live glint onto its gem. The gem's x/y are document coordinates — board.root,
  // boardSlot and scene.root are all untransformed, which is the same thing _startHint already
  // relies on to drive the HUD cursor off board.cellX — so a sprite on `world` can take them
  // straight. Scale is multiplied through, so the 1.2 pulse showHint puts on the hint gems
  // carries into the glint sitting on them.
  _followSparks() {
    if (!this._sparks) return;
    for (let i = 0; i < this._sparks.length; i++) this._followSpark(i);
  }

  _followSpark(i) {
    const s = this._sparks[i];
    const st = this._sparkState[i];
    if (!s.visible || !st.gem) return;
    const g = st.gem;
    s.position.set(g.x + st.ox * g.scale.x, g.y + st.oy * g.scale.y);
    s.scale.set(st.k * g.scale.x, st.k * g.scale.y);
  }

  _hideHint() {
    gsap.killTweensOf(this.cursor);
    this.cursor.visible = false;
    this._hintOn = false;
    this._hintCells = null;
    // The queued calls first: a stream schedules its next glint from its sparkle's onComplete, so
    // killing only the tweens would leave a delayedCall still pending to start a fresh one.
    for (const c of this._sparkCalls ?? []) c?.kill();
    for (let i = 0; i < (this._sparks?.length ?? 0); i++) {
      const s = this._sparks[i];
      gsap.killTweensOf([s, this._sparkState[i]]);
      s.visible = false;
      // A killed tween never reaches its onComplete, so the gem has to be let go here too — or
      // the follow would keep dragging a hidden sprite around a gem the next round has reused.
      this._sparkState[i].gem = null;
    }
    this.board.hideHint();
  }

  // ---------------- tick ----------------

  update(dt) {
    if (!this.board) return;
    this.board.update(dt);

    // EVERYTHING THE HERO ANSWERS TO IS WRITTEN BEFORE HE IS DRAWN, and the order here is the
    // whole of it. `hero.update` does not merely advance him — the rig RENDERS inside it, on its
    // own canvas, the moment it is called. This block used to sit below that call, which meant
    // the man was drawn from last frame's offset while the pillar he is braced against had
    // already been moved to this frame's. The error is one frame of the pillar's velocity, so it
    // grew and shrank as the pillar surged and settled: he floated against it, and his hands went
    // in and out of the stone. Nothing about the ramp or the standoff could have fixed that.
    //
    // Within the block: `push` comes from the board, the pillar is placed from `push`, and both
    // the shaft's left bound and the hero's offset are read back off the PLACED pillar — so each
    // line depends on the one above it and none of them may be reordered either.
    const push = this.board.push;
    this.scene.setPush(push);
    // The other half of the same threat: the pillar drives him left, the spikes come out to
    // meet him. One number, so they cannot drift apart.
    this.scene.setSpikes(push);
    // The rubble bears on the pillar's face, so the shaft wall travels with it. Without this
    // the mass sits at the board edge and an empty strip opens as the pillar is driven back.
    this.board.setLeftBound(this.scene.pillarRight);
    // The hero is braced against the pillar, so he rides its offset toward the spikes.
    this.hero.setOffsetX(this.scene.pushOffset);
    // `push`, not `pressure`. This used to read `pressure` — the instantaneous contact force —
    // on the argument that he should brace the moment the mass lands rather than once he has
    // been shoved halfway to the spikes. That was right for a continuous weight blend and is
    // wrong for the three discrete stamina phases the rig actually ships: stepping poses on a
    // spiky signal flickers, and "stamina" is `push` by definition. It is also the number the
    // ring draws, so the two can never disagree about how he is doing.
    this.hero.setFatigue(push);

    // ...and only now is he placed, posed and rendered, from the values just written.
    this.hero.update(dt);
    // After him, because it aims at his hand bone. Cheap while it is hidden, which is every
    // frame but the last three seconds of a win.
    this.rope.update(dt);
    // Empty for all but the first second of the round, and an empty list costs a loop that does
    // not run — the same deal the rope gets.
    this.dust.update(dt);
    // After hero.update, so the camera lands on where he is THIS frame rather than trailing him
    // by one, and before _applyShake, which offsets from the base position this writes.
    if (this._camFollow) {
      this._cam.x = this.hero.bodyX;
      this._cam.y = this.hero.bodyY;
      this._applyCamera();
    }
    this._applyShake(dt);
    // Only while the card is up — no reason to spawn light onto a hidden container.
    if (this.winGroup.visible) {
      this.sparkles.update(dt);
      this.confetti.update(dt);
    }

    // After hero.update, not merely after setOffsetX: the badge tracks `bodyX`, which the rig
    // only recomputes when it is placed. Reading it before that put the gauge a frame behind him
    // for the same reason he was a frame behind the pillar.
    this._placeStamina();
    this._drawStamina(dt);
    // After board.update above, so a glint sits on where its gem is this frame, not last.
    this._followSparks();

    if (this.state !== 'play') return;

    // The grunt, on the frame he loses a stamina phase. Edge-triggered on the RIG's phase index
    // rather than on a threshold of `push`, for the reason _drawStamina gives about the ring's
    // colour: a second set of numbers on the same signal drifts out of step with the pose the
    // moment either is retuned. So the sound, the amber ring and the drop into idle_1 are one
    // event by construction. Only on the way DOWN in stamina — a drain that hands him ground
    // back steps the phase the other way and re-arms this, it does not grunt.
    //
    // NOT on the step into the last phase. It reads as repetitive there and it is: the round
    // spends most of its time around that boundary, and every drain that pulls him back under
    // 0.60 re-arms an edge that 0.68 trips again moments later, so the same grunt keeps landing.
    // The last phase already has a voice — the heartbeat and the red frame — and this one on top
    // of it was the third thing saying the same thing.
    const phase = this.fatiguePhase;
    if (phase > this._fatiguePhase && phase < 2) this.audio.playStruggle();
    this._fatiguePhase = phase;
    // ...and the last phase brings the frame and the heartbeat with it. Level-triggered off the
    // same index, not edge-triggered like the grunt: the grunt is the moment he slips, this is
    // the state he is in, and it has to end when a drain gives him ground back.
    this._setPanic(phase >= 2);
    // ...and it runs faster the less of him is left. After _setPanic, so the first frame of a new
    // panic already has its tempo rather than beating once at the slow rate first.
    if (this._panic) this._setPanicTempo(1 - push);

    const danger = push > DANGER_AT;
    this.hurry.visible = danger;
    // The warning and the tension loop are the same state, read off the same number, so they
    // cannot drift apart.
    this._setDanger(danger);
    // The instruction is gone for good once they have played; from here the banner is only
    // ever the warning, so it fades back in with it and out again when the shaft drains.
    this.title.visible = false;
    this._showBanner(danger);
    if (danger) this.hurry.alpha = 0.55 + 0.45 * Math.sin(performance.now() / 90);

    const outcome = this.board.outcome;
    if (outcome === 'fail') this._fail();
    else if (outcome === 'win') this._win();
  }

  // ---------------- outcomes ----------------

  async _win() {
    if (this.state === 'win' || this.state === 'fail') return;
    this.state = 'win';
    this.board.enabled = false;
    this.board.stopInflow();
    this.hurry.visible = false;
    this._showBanner(false);
    this._hideHint();
    // Off before the outro, not with the end card. The gauge tracks him, and the next five
    // seconds are a pillar going over the edge and a man leaving on a rope — a stamina readout
    // chasing him out of the chamber is reporting a threat that is already over.
    this._showStamina(false);
    try { this.sdk?.finish?.(); } catch (e) {}

    // The outro, in beats. Nothing is removed from the board — the path was cleared by
    // playing, so sweeping the remainder here would take credit for the player's work.
    //   1. a rope drops in from above the top edge and swings across to him
    //   2. he takes it at the top of its arc — and only THEN does the pillar go over, breaking
    //      up on the way down into rubble that falls through the board he cleared
    //   3. he rides the rope back out while the chamber comes apart behind him
    //   4. he fades, end card
    //
    // THE COLUMN STANDS UNTIL HE IS OFF IT, and that ordering is the whole point. It used to go
    // over on the outro's first frame, in parallel with the rope. Filmed, that reads badly: the
    // column is a diagonal shard by 0.4s and gone by 0.6s, and the rope does not reach his hands
    // until 1.25s — so for three quarters of a second, on the best shot in the ad, he holds a
    // full brace pose against blank wall with his hands closed on nothing.
    //
    // Starting it at the grab instead makes the beat causal — he takes the rope, lets go, and
    // the column he was holding up goes with the chamber — and it costs no time at all: the fall
    // is 0.72s end to end against the 1.67s of swing it now runs under, so the escape is still
    // the longer of the two and the card lands on the same frame it did before.
    //
    // The old note here warned that a rope given a head start would swing through a column still
    // standing. It does cross it, in the last ~0.3s of the arc — and that was never the problem
    // it sounds like: the rope is a Pixi mesh added straight to `world`, so it draws in FRONT of
    // the column. A rope hanging in front of a pillar is a rope hanging in front of a pillar.
    //
    // The topple still goes to the RIGHT, over the shaft and away from where he was standing, so
    // its debris never lands on him. He is travelling right too, but a good half second ahead of
    // it and rising — and he is on #three-canvas above every Pixi layer, so the column falls
    // behind him rather than through him.
    this._setDanger(false);
    // The threat is over the moment the pillar goes; the frame must not still be beating over a
    // man on a rope. Off here rather than with the end card, exactly like the stamina gauge.
    this._setPanic(false);
    // The pose freezes with them, and for the same reason. `push` decays as the pillar goes and
    // the shaft drains, and the phase machine reads that as recovery — so without this he stands
    // off and unwinds through idle_1 and idle_0 while the rope is on its way to him, three
    // cross-fades of a man getting his breath back in the middle of his escape. He holds the pose
    // he won in until the rope clip claims the body, which it can do from any pose.
    this.hero.holdPose();
    this.audio.play('win');
    // box(), not centerOf(): the door is painted into the backdrop and ships no sprite of its
    // own any more, and centerOf() insists on shipped art. Only the PSD's placement is wanted.
    const door = box('door_original_exact');
    // Handed in rather than started here, because the beat it belongs to is inside the escape —
    // the frame his hands leave the stone. `collapse` is filled in by that callback.
    let collapse = null;
    const escape = this._ropeEscape(
      door ? door.x + door.width / 2 : 887,
      () => { collapse = this._collapsePillar(); },
    );
    await escape;
    // Already finished in the game as it stands — the fall ends ~0.6s before the escape hands
    // back — so this is a backstop for the day either duration is retuned, not a wait.
    await collapse;
    this.audio.duckMusic(true);
    this.audio.play('winCheer');
    this._showEnd(this.winGroup);
  }

  // The rope drives this beat and the hero answers to it, rather than the other way round: the
  // rope decides when it reaches him, and `onGrab` is that frame. Aiming the two at each other
  // independently would mean tuning one against the other every time either changed.
  //
  // `targetX` is only the fallback target — with the rig present the rope clip carries its own
  // travel and the argument goes unused. Without the rig there is no swing to sell, so the rope
  // stays down and he runs for the door as he did before it existed.
  //
  // Both are awaited. The rope timeline is the longer of the two by ~30ms, but that is a tuning
  // coincidence and not something the end card should depend on.
  // `onLetGo` fires on the frame his hands come off the stone, which is the frame the column
  // loses what was holding it. Both paths below call it exactly once — a placeholder build has
  // no grab, so there it is the first stride of the run.
  async _ropeEscape(targetX, onLetGo) {
    if (!this.rope?.mesh || !this.hero.rig) {
      // No rope and no rig, so there is no grab to hit — he simply runs, and the cheer goes on
      // the start of the run, which is the moment the escape becomes his in this version.
      this.audio.play('ropeGrab', { volume: 0.8 });
      onLetGo?.();
      return this._awaitAllBut(this.hero.escape(targetX), WIN_CARD_LEAD);
    }
    this.audio.play('swap', { volume: 0.45 });   // the whoosh, as it pays out over the edge
    let swing = null;
    // The grab POINT, not his standing x — the rope has to be the right length before he takes
    // hold, and that length is the anchor to his HANDS. hero owns those offsets because they are
    // properties of its escape clip. From the grab onward `aim` takes over and the rope tracks
    // the hand bone itself, so contact holds however the clip moves him.
    await this.rope.play({
      grab: this.hero.ropeGrabPoint(),
      aim: () => this.hero.handPoint(),
      onGrab: () => {
        // The one frame the rope is in his hands. The rope decides when that is, so the cheer
        // rides its callback rather than being timed against it from out here.
        this.audio.play('ropeGrab', { volume: 0.8 });
        swing = this.hero.escape(targetX);
        // Last, so the column goes over a frame after his hands have left it rather than on the
        // same one. Its own 0.10s of anticipation carries the rest of that read.
        onLetGo?.();
      },
    });
    await this._awaitAllBut(swing, WIN_CARD_LEAD);
  }

  // Waits out a timeline except for its last `lead` seconds, and leaves it running. The caller
  // gets the beat back early rather than the timeline being cut short — he keeps swinging and
  // fading behind the card that is already coming up over him.
  _awaitAllBut(tl, lead) {
    if (!tl) return Promise.resolve();
    const left = Math.max(0, tl.duration() - tl.time() - lead);
    return new Promise((resolve) => { gsap.delayedCall(left, resolve); });
  }

  // The pillar goes over. Scene owns the fall — it is the one thing in the chamber that is a
  // rigid object rather than a mass — and the board owns the rubble it breaks into, because only
  // the board knows what is left standing to jam it.
  //
  // Two sounds, because it is two events: the stone letting go as it tips, then the rockfall on
  // the shatter. The latter is the drain cue — stone_2/3/4 are the hard-attack samples, which is
  // exactly what this is — played up, because a column coming apart is the largest thing in the
  // round. The shake goes with the break, not the tip.
  _collapsePillar() {
    this.audio.play('plate', { volume: 0.5 });
    return this.scene.collapsePillar((frame) => {
      this.audio.play('drain', { volume: 0.6 });
      // The way opening. It used to play as the rope was launched, which is now the same instant
      // as the pillar being pushed — four cues on one frame. Here it is 0.6s later and on the
      // beat it actually describes: the column comes apart and the way out is clear.
      this.audio.play('door', { volume: 0.7 });
      this._shake = 0.9;
      this.board.collapsePillar(frame);
    });
  }

  _fail() {
    if (this.state === 'win' || this.state === 'fail') return;
    this.state = 'fail';
    this.board.enabled = false;
    this.board.stopInflow();
    this.hurry.visible = false;
    this._showBanner(false);
    this._hideHint();
    // It goes with him. He is crushed on this beat and the ring is empty by definition, so
    // leaving it standing over the spikes only delays the card.
    this._showStamina(false);
    this._setDanger(false);
    // Faster than PANIC_OFF would suggest is not wanted here: the frame fading out under the FAIL
    // card is the last of him, and the card's own scrim comes up over it in 0.3s regardless.
    this._setPanic(false);
    this.audio.duckMusic(true);
    // The spikes go home first, under the card's fade — the crush is what killed him, so it has
    // to be on screen rather than implied by a title card appearing.
    this.scene.slamSpikes();
    this._shake = 0.7;
    this.audio.play('plate', { volume: 0.8 });
    this.audio.play('fail');
    this._showEnd(this.failGroup, FAIL_END_FADE);
    try { this.sdk?.finish?.(); } catch (e) {}
  }

  _showEnd(group, fade = END_FADE) {
    const won = group === this.winGroup;
    // Here rather than in _win/_fail, and for both cards, because this is the beat the player is
    // being asked to read something: the sting, the cheer and the card's own arrival all land on
    // it, and rubble at round volume is the one thing on the mix loud enough to bury them. The
    // collapse keeps its full weight during the outro that leads up to this — it is a beat of its
    // own — and only steps back once there is a card to step back for.
    this.audio.duckDebris(true);
    this.winGroup.visible = won;
    this.failGroup.visible = group === this.failGroup;
    // On the win the whole screen is the call to action; on the fail it is nothing at all, so
    // TRY AGAIN is the only thing under the player's thumb. See _buildOverlays.
    this.dim.eventMode = won ? 'static' : 'none';
    this.dim.cursor = won ? 'pointer' : 'default';
    this.overlay.visible = true;
    this.overlay.alpha = 0;
    gsap.to(this.overlay, { alpha: 1, duration: 0.3 });
    // The hero goes with the scene, but not necessarily on the same beat — see FAIL_END_FADE.
    // He is the one thing the dim cannot cover on its own; see Hero.fadeOut for why that is a
    // property of the canvas he lives on rather than of the display list.
    this.hero.fadeOut(fade);
    // ...and so do the spike tips, which are up on his canvas for the same reason and would
    // otherwise stand over the FAIL title alongside him.
    this.scene.fadeSpikeTips(fade);

    // The gameplay CTA goes away with the board. Both end cards carry their own call to action
    // — OPEN and TRY AGAIN — and leaving the download button sitting under the dim gives the
    // player two competing things to tap at exactly the moment the card is asking for one.
    // Faded rather than cut, on the same beat as the dim coming up.
    gsap.to(this.cta, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => { this.cta.visible = false; },
    });
    // The mute toggle goes with it, and not only for tidiness: on the win card the scrim IS the
    // call to action and it covers the whole screen, so a sound button left underneath would be
    // unreachable anyway — every tap on it would open the store instead. Better absent than
    // present and lying about what it does.
    gsap.to(this.soundBtn, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => { this.soundBtn.visible = false; },
    });
    group.scale.set(0.3);
    gsap.to(group.scale, { x: 1, y: 1, duration: 0.6, ease: 'back.out(1.6)' });
    // Only the card on screen hops. The other's button is stopped rather than left running: it
    // is invisible, but its timeline would keep ticking for the rest of the session, and a retry
    // would then show a button already mid-hop.
    this._pulse(won ? this.winBtn : this.failBtn);
    this._stopPulse(won ? this.failBtn : this.winBtn);
    if (this.rays && group === this.winGroup) {
      gsap.to(this.rays, { rotation: Math.PI * 2, duration: 18, repeat: -1, ease: 'none' });
      // Fired here rather than in _win() so a retried win throws it again — this is the moment
      // the card appears, which is the moment the burst belongs to.
      this.confetti.burst();
    }
  }

  // The SDK gets first refusal, because inside a real network the click is not a navigation —
  // it is mraid.open / FbPlayableAd.onCTAClick / ExitApi.exit, and only the SDK knows which.
  // Standalone it falls through its own chain to window.open(destinationUrl), which is why
  // vite.config has to define APP_STORE_URL and GOOGLE_PLAY_URL.
  //
  // The plain open below is NOT dead code, and it is deliberately outside the SDK's try: the
  // package is a hard dependency, so `sdk` is never null and an `else` could never be reached —
  // which is precisely how the CTA came to look wired up and go nowhere. Now anything that stops
  // the SDK from navigating, including it throwing, still lands the player on the URL.
  _cta() {
    try {
      if (this.sdk?.install) { this.sdk.install(); return; }
    } catch (e) { /* fall through and open it ourselves */ }
    try { window.open(CTA_URL, '_blank'); } catch (e) {}
  }

  // The in-game toggle. Routed through _setMuted so it cannot disagree with the SDK's own volume
  // event — see setVolume, which lands in the same place.
  _toggleSound() {
    this._setMuted(!this._muted);
  }

  // One place where the mute state is written, and the icon is a function of it rather than a
  // second copy of it. A tap and an ad network's volume event both arrive here.
  _setMuted(m) {
    this._muted = m;
    this.audio?.setMuted(m);
    if (!this.soundIcon) return;
    const u = url(m ? 'ui_btn_sound_off' : 'ui_btn_sound_on');
    if (u) this.soundIcon.texture = PIXI.Texture.from(u);
  }

  // Ad networks own the mute control too, and drive it from the SDK rather than the button — so
  // this has to move the button with it, or the icon starts lying about the state.
  setVolume(v) {
    this._setMuted(!v);
  }
}
