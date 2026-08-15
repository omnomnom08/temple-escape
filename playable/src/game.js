import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { Board2D } from './board2d.js';
import { Hero } from './hero.js';
import { Scene } from './scene.js';
import { DOC, layer, url, box, centerOf } from './layers.js';
import { Audio } from './audio.js';
import { Chest } from './chest.js';
import { SparkleField } from './sparkle.js';
import { Confetti } from './confetti.js';

// Composition and state. Two containers hang off the stage:
//
//   world — document space (1280x1280), scaled and centred by Layout. Everything painted.
//   hud   — also document units, but anchored to the SCREEN edges rather than the artboard,
//           because the PSD parks the stamina meter and cursor off-canvas on purpose: they
//           are shared between portrait and landscape and positioned at runtime.

const DANGER_AT = 0.6;   // pillar travel (board.push) above this starts the HURRY warning

// TODO(ship): point at the real store listing. Only used standalone — see _cta().
const STORE_URL = 'https://example.com';

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

export class Game {
  constructor({ pixiApp, layout, sdk }) {
    this.app = pixiApp;
    this.layout = layout;
    this.sdk = sdk;
    this.state = 'idle';
    this._shake = 0;
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
        'HURRY_UP', 'btn', 'DOWNLOAD', 'cursor', 'chest_closed',
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
    });
    this._buildHud();
    this._buildOverlays();
    // Already in the cache — board2d's shine emitter loads the same texture — so this resolves
    // immediately and only exists to give the field its Texture handle.
    await Promise.all([this.sparkles.load(), this.confetti.load()]);
    this.layoutChanged();
    this._enterScene();
  }

  // ---------------- layout ----------------

  layoutChanged() {
    if (!this.world) return;
    const L = this.layout;
    this.world.scale.set(L.scale);
    // Remembered so the shake can offset from it without fighting the layout.
    this._worldBase = { x: L.originX, y: L.originY };
    this.world.position.set(L.originX, L.originY);
    this.hud.scale.set(L.scale);
    this.hud.position.set(L.originX, L.originY);
    // Rubble enters from just above the visible frame and leaves below it, wherever those
    // are for this aspect ratio.
    this.board?.setSpawnY(L.edges.top - 40);
    this.board?.setDrainY(L.edges.bottom + 60);
    // The Three canvas is stretched over the whole viewport by CSS, so its camera has to be
    // driven from the same edges or the rig only lines up with the Pixi world on a square screen.
    this.hero?.setViewport(L);
    this._anchorHud();
  }

  // HUD lives in document units but hangs off the viewport edges, so it stays on screen at
  // any aspect ratio — which is the whole reason those layers were authored off-canvas.
  //
  // The two orientations have their free space in different places, so they get different
  // rules rather than a shared one. In portrait the playfield leaves room above and below;
  // in landscape it fills almost the whole height (visible doc y is ~280..1000 against a
  // playfield of 325..955) and the room is at the sides instead. Anchoring top-centre and
  // bottom-centre in both puts the banner over the hero and the CTA on top of the board.
  _anchorHud() {
    if (!this.stamina) return;
    const L = this.layout;
    const e = L.edges;

    if (L.portrait) {
      this.titleGroup.scale.set(1);
      this.stamina.scale.set(1);
      this.cta.scale.set(1);

      this.titleGroup.position.copyFrom(L.anchor('center', 'top', 0, 150));
      // Below the banner, not beside it — at inset 130 the 205px meter overlapped it and ate
      // the last letters. 330 is the y the PSD authored it at.
      this.stamina.position.copyFrom(L.anchor('right', 'top', 125, 330));
      this.cta.position.copyFrom(L.anchor('center', 'bottom', 0, 120));
    } else {
      this.titleGroup.scale.set(0.62);
      this.stamina.scale.set(0.85);
      this.cta.scale.set(0.9);

      // Left gutter for the banner and the CTA, right gutter for the meter.
      this.titleGroup.position.set(e.left + 180, e.top + 75);
      this.cta.position.set(e.left + 130, e.bottom - 95);
      this.stamina.position.set(e.right - 120, e.top + 205);
    }

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
    // Title banner
    this.titleGroup = new PIXI.Container();
    this.hud.addChild(this.titleGroup);
    this.textBack = this._sprite('text_back', this.titleGroup);
    this.title = this._sprite('MERGE_TO_SAVE_HIM', this.titleGroup);
    this.hurry = this._sprite('HURRY_UP', this.titleGroup);
    this.hurry.visible = false;

    // Stamina meter — the arm icon in its ring, with an arc that drains as pressure rises.
    // It reads the same 0..1 the pillar does, so it is a readout of the real threat rather
    // than a second, abstract progress bar.
    this.stamina = new PIXI.Container();
    this.hud.addChild(this.stamina);
    this.staminaArc = new PIXI.Graphics();
    this.stamina.addChild(this.staminaArc);
    this._sprite('progressbar', this.stamina);
    this._sprite('arm_icon', this.stamina);

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
    gsap.to(this.cta.scale, { x: 1.06, y: 1.06, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // Tutorial hand. Authored at 139x176 for a decorative pose; over 62px cells that covers
    // four of them, including the pair it is pointing at. Scaled down and anchored near the
    // fingertip so it indicates a cell instead of hiding it.
    this.cursor = this._sprite('cursor', this.hud, { anchorX: 0.28, anchorY: 0.12 });
    this.cursor.scale.set(0.55);
    this.cursor.visible = false;
  }

  _drawStamina() {
    // Ground he has left before the spikes, not the weight on him this instant — so the ring
    // drains monotonically as he loses and visibly refills when a drain gives him ground back.
    const left = 1 - (this.board?.push ?? 0);
    const r = 88;
    const g = this.staminaArc;
    g.clear();
    g.circle(0, 0, r).fill({ color: 0x000000, alpha: 0.35 });
    if (left <= 0) return;
    // green while he can hold, red as he runs out
    const color = left > 0.5 ? 0x4ad36a : left > 0.25 ? 0xffc23f : 0xff4b2b;
    g.moveTo(0, 0)
      .arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
      .lineTo(0, 0)
      .fill({ color, alpha: 0.85 });
  }

  // ---------------- overlays ----------------

  _buildOverlays() {
    this.overlay = new PIXI.Container();
    this.overlay.visible = false;
    this.hud.addChild(this.overlay);

    this.dim = new PIXI.Graphics();
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
    this._sprite('FAIL', this.failGroup, { fromDoc: true });
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

  // ---------------- flow ----------------

  _enterScene() {
    this.state = 'intro';
    this.overlay.visible = false;
    this.hurry.visible = false;
    this.board.enabled = false;
    this.hero.dropIn().then(() => this._resetState());
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
    this.hurry.visible = false;
    this.title.visible = true;
    gsap.killTweensOf(this.titleGroup);
    this.titleGroup.alpha = 1;
    this._banner = true;
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

  reset() {
    gsap.killTweensOf(this.cursor);
    this.board.reset();
    this.hero.place();
    // Before setPush, which is a no-op while the pillar is down — a retry after a win would
    // otherwise start the round with no pillar and the shaft wall still opened out to where its
    // rubble was.
    this.scene.restorePillar();
    this.scene.setPush(0);
    this._setDanger(false);
    this.audio.duckMusic(false);
    this.winGroup.visible = false;
    this.failGroup.visible = false;
    this.chest.reset();
    this.sparkles.reset();
    this.confetti.reset();
    this._resetState();
    try { this.sdk?.retry?.(); } catch (e) {}
  }

  _onFirstMove() {
    if (this.state !== 'idle') return;
    this.state = 'play';
    this._hideHint();
    this._showBanner(false);  // they have understood it; the screen is better off without it
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
    const mag = 7 * this.layout.scale * this._shake * this._shake; // ease out sharply
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

  _hideHint() {
    gsap.killTweensOf(this.cursor);
    this.cursor.visible = false;
    this.board.hideHint();
  }

  // ---------------- tick ----------------

  update(dt) {
    if (!this.board) return;
    this.board.update(dt);
    this.hero.update(dt);
    this._applyShake(dt);
    // Only while the card is up — no reason to spawn light onto a hidden container.
    if (this.winGroup.visible) {
      this.sparkles.update(dt);
      this.confetti.update(dt);
    }

    const push = this.board.push;
    this.scene.setPush(push);
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
    this._drawStamina();

    if (this.state !== 'play') return;

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
    try { this.sdk?.finish?.(); } catch (e) {}

    // The outro, in beats. Nothing is removed from the board — the path was cleared by
    // playing, so sweeping the remainder here would take credit for the player's work.
    //   1. the pillar goes over the edge, and breaks up on the way down into rubble that falls
    //      through the board he cleared and jams on what he left standing
    //   2. on the shatter, he swings out on the rope
    //   3. he fades, end card
    //
    // Strictly in that order, and it is the topple that allows it: the column goes over to the
    // RIGHT, away from him and down the shaft, so there is no frame in which its debris is
    // landing on the man who just escaped.
    this._setDanger(false);
    this.audio.play('win');
    await this._collapsePillar();
    const door = centerOf('door_original_exact');
    this.audio.play('door', { volume: 0.7 });   // the way opening, under the start of the swing
    // The door x is only the fallback target: with the rig present the rope clip carries its own
    // travel, and this argument goes unused.
    await this.hero.escape(door ? door.x : 887);
    this.audio.duckMusic(true);
    this.audio.play('winCheer');
    this._showEnd(this.winGroup);
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
    this._setDanger(false);
    this.audio.duckMusic(true);
    this.audio.play('fail');
    this._showEnd(this.failGroup);
    try { this.sdk?.finish?.(); } catch (e) {}
  }

  _showEnd(group) {
    this.winGroup.visible = group === this.winGroup;
    this.failGroup.visible = group === this.failGroup;
    this.overlay.visible = true;
    this.overlay.alpha = 0;
    gsap.to(this.overlay, { alpha: 1, duration: 0.3 });
    // The hero goes with the scene, on the same beat. He is the one thing the dim cannot cover
    // on its own — see Hero.fadeOut for why that is a property of the canvas he lives on rather
    // than of the display list.
    this.hero.fadeOut(0.3);

    // The gameplay CTA goes away with the board. Both end cards carry their own call to action
    // — OPEN and TRY AGAIN — and leaving the download button sitting under the dim gives the
    // player two competing things to tap at exactly the moment the card is asking for one.
    // Faded rather than cut, on the same beat as the dim coming up.
    gsap.to(this.cta, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => { this.cta.visible = false; },
    });
    group.scale.set(0.3);
    gsap.to(group.scale, { x: 1, y: 1, duration: 0.6, ease: 'back.out(1.6)' });
    if (this.rays && group === this.winGroup) {
      gsap.to(this.rays, { rotation: Math.PI * 2, duration: 18, repeat: -1, ease: 'none' });
      // Fired here rather than in _win() so a retried win throws it again — this is the moment
      // the card appears, which is the moment the burst belongs to.
      this.confetti.burst();
    }
  }

  _cta() {
    try {
      if (this.sdk?.install) this.sdk.install();
      else window.open(STORE_URL, '_blank');
    } catch (e) {}
  }

  // Ad networks own the mute control, so this is driven from the SDK rather than a button.
  setVolume(v) {
    this.audio?.setMuted(!v);
  }
}
