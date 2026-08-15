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

export class Layout {
  constructor() {
    this.vw = 1;
    this.vh = 1;
    this.scale = 1;
    this.originX = 0;
    this.originY = 0;
    this.cropped = false;
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
    return this;
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
