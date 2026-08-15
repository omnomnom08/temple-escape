// Orientation-aware layout.
//
// The art is authored on a 1280x1280 square canvas on purpose: the backdrop cover-scales for
// BOTH portrait and landscape, cropping the sides in one and the top and bottom in the other.
// So this module does not letterbox a fixed design box — it computes one world scale that
// satisfies two competing constraints, and exposes screen-space anchors for the HUD pieces
// that were deliberately parked off-canvas in the PSD.
//
// The two constraints:
//
//   COVER — the backdrop must fill the viewport, so   scale >= max(vw, vh) / 1280
//   FIT   — the playfield must be fully visible, so   scale <= min(vw / playW, vh / playH)
//
// Normally cover <= fit and we take cover, which fills the screen with the least crop. On an
// extreme aspect ratio (a very wide desktop window) the two invert — there is no scale that
// both fills the screen and keeps the playfield on it. Gameplay wins; the backdrop letterboxes
// against the page colour, which is sampled from the art so the seam is hard to see.

export const DOC_SIZE = 1280;

// The playfield: everything the player must be able to see, in document coordinates.
// Measured from the layer manifest — spikes at x=367 through the door ending at x=922,
// pillar top at y=325 down through the last plate row ending at y=955.
const PLAY = { x: 367, y: 325, w: 555, h: 630 };

const PAD = 1.04; // a little breathing room so nothing sits flush against the edge

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Layout {
  constructor() {
    this.vw = 1;
    this.vh = 1;
    this.scale = 1;
    this.originX = 0;
    this.originY = 0;
    this.cropped = false;

    // The camera, as a zoom about a point in document units. It is deliberately NOT a second
    // transform bolted on in the game: the Pixi world, the Three frustum and the HUD all derive
    // their placement from this object, and a camera owned anywhere else would have to be
    // re-applied to each of them by hand and would drift from one of them the first time a new
    // one was added. Identity is zoom 1 on the document centre, which reproduces the layout
    // exactly as it is without a camera — see worldScale/worldOrigin below.
    this.zoom = 1;
    this.camX = DOC_SIZE / 2;
    this.camY = DOC_SIZE / 2;
    this._camX = this.camX;
    this._camY = this.camY;
  }

  resize(vw, vh) {
    this.vw = vw;
    this.vh = vh;

    const cover = Math.max(vw, vh) / DOC_SIZE;
    const fit = Math.min(vw / (PLAY.w * PAD), vh / (PLAY.h * PAD));

    this.scale = Math.min(cover, fit);
    // true when the backdrop can no longer fill the viewport — the caller paints the gap
    this.cropped = fit < cover;

    // The composition is centred on the document (playfield centre is 644,640 against a
    // 640,640 document centre), so centring the document centres the game.
    this.originX = vw / 2 - (DOC_SIZE / 2) * this.scale;
    this.originY = vh / 2 - (DOC_SIZE / 2) * this.scale;
    // The clamp is in viewport units, so a rotation mid-zoom has to re-run it.
    this._clampCam();
    return this;
  }

  // Look at (x,y) in document units, magnified by `zoom`. Zoom is floored at 1: below it the
  // backdrop stops covering the viewport, which is the one thing the whole scale calculation
  // above exists to prevent.
  setCamera(zoom = 1, camX = DOC_SIZE / 2, camY = DOC_SIZE / 2) {
    this.zoom = Math.max(1, zoom);
    this.camX = camX;
    this.camY = camY;
    this._clampCam();
    return this;
  }

  // The camera may not look off the edge of the document. There is nothing painted outside the
  // 1280 square, so a zoom that drifts past a border shows void — and the clamp is what lets a
  // caller simply point the camera at a falling man without also having to know where the walls
  // are. Where the visible span is WIDER than the document there is nothing to clamp against
  // and the document is centred instead, which is the uncropped behaviour unchanged.
  _clampCam() {
    const s = this.worldScale;
    const halfW = this.vw / (2 * s);
    const halfH = this.vh / (2 * s);
    this._camX = halfW * 2 >= DOC_SIZE ? DOC_SIZE / 2 : clamp(this.camX, halfW, DOC_SIZE - halfW);
    this._camY = halfH * 2 >= DOC_SIZE ? DOC_SIZE / 2 : clamp(this.camY, halfH, DOC_SIZE - halfH);
  }

  // The world transform, camera included. At zoom 1 these are exactly `scale` and `origin`
  // above — the clamp pins the centre to 640,640 in every case that reaches them — so the HUD
  // can keep reading the plain ones and stay put while the world moves under it.
  get worldScale() { return this.scale * this.zoom; }

  get worldOriginX() { return this.vw / 2 - this._camX * this.worldScale; }

  get worldOriginY() { return this.vh / 2 - this._camY * this.worldScale; }

  // What the camera can see, in document units. The Three frustum is built from this, so the
  // rig zooms with the painted chamber instead of sliding across it.
  get worldEdges() {
    const s = this.worldScale;
    const ox = this.worldOriginX;
    const oy = this.worldOriginY;
    return {
      left: -ox / s,
      top: -oy / s,
      right: (this.vw - ox) / s,
      bottom: (this.vh - oy) / s,
    };
  }

  get portrait() { return this.vh >= this.vw; }

  // document space -> screen pixels
  toScreenX(dx) { return this.originX + dx * this.scale; }
  toScreenY(dy) { return this.originY + dy * this.scale; }

  // Screen edges expressed in document coordinates, so HUD elements can be anchored to the
  // viewport while still being positioned and sized in the same units as everything else.
  get edges() {
    return {
      left: -this.originX / this.scale,
      top: -this.originY / this.scale,
      right: (this.vw - this.originX) / this.scale,
      bottom: (this.vh - this.originY) / this.scale,
    };
  }

  // Anchor a HUD element inset from a screen corner/edge, in document units.
  // The PSD parks progressbar/arm_icon/cursor off-canvas precisely because they belong here
  // rather than at their authored coordinates.
  anchor(hAlign, vAlign, insetX = 0, insetY = 0) {
    const e = this.edges;
    const x = hAlign === 'left' ? e.left + insetX
      : hAlign === 'right' ? e.right - insetX
        : (e.left + e.right) / 2;
    const y = vAlign === 'top' ? e.top + insetY
      : vAlign === 'bottom' ? e.bottom - insetY
        : (e.top + e.bottom) / 2;
    return { x, y };
  }
}
