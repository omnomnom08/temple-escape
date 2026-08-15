import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The rigged explorer, rendered on #three-canvas above the Pixi board.
//
// COORDINATES. The camera is orthographic and its frustum is driven from Layout, in the same
// document units as the Pixi world — so `place(x, footY)` takes Pixi coordinates and needs no
// conversion table. Three's +Y is up and Pixi's is down, so y is flipped on the way in
// (`H - y`) rather than by scaling the model by -1, which would invert normals and break the
// lighting. See setViewport: nothing here works until that has been called.
//
// FAIL-SOFT. `create()` resolves to null if there is no rig file, no canvas, or no WebGL.
// The caller keeps its 2D placeholder in that case, so a missing asset is never a black
// screen — see hero.js.
//
// ORIENTATION. Measure this from the ANIMATED poses, never from the bind pose — they disagree
// by ninety degrees and the bind pose is the misleading one. Bound, the rig is an A-pose with
// its arms along Z, which invites the conclusion that it faces X. In every clip that actually
// ships, the hands span X and reach +Z: left-right is X and he faces +Z, straight out of the
// screen. Rendered as authored he shoves the camera.
//
// Hence FACING_YAW. A quarter turn maps his forward (+Z) onto world +X, which is screen-right
// and the side the pillar is on, and folds his left-right axis into depth so we see him in
// profile. It also happens to be what the rope escape wants: that clip travels +4.26u along Z,
// which the same turn lays across the screen instead of into it.

const FACING_YAW = Math.PI / 2;

// The bone the outro rope is tied to. Either hand would do — the quarter turn above puts him in
// profile, so the two sit on top of each other in screen x — and the right one is the upstage
// hand in the rope clip.
//
// Matched on a NORMALISED name, not on the one in the file. GLTFLoader runs every node name
// through PropertyBinding.sanitizeNodeName, which strips the characters reserved by the
// animation path syntax — so `mixamorig:RightHand` in the GLB is `mixamorigRightHand` by the
// time it reaches the scene graph, and getObjectByName with the authored name finds nothing.
// Silently: it returns undefined, so the rope simply never had a hand to hold.
// Matched as a suffix, so it holds whatever prefix the exporter used. Unambiguous against the
// rest of the skeleton: the finger bones end in Index1/2/3, not in the hand's own name.
const HAND_BONE = 'righthand';
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const _v = new THREE.Vector3();

const CLIPS = ['idle_0', 'idle_1', 'idle_2', 'land', 'push', 'rope'];

// The three stamina phases, in order of exhaustion.
//
// These are STATES, not the endpoints of a blend. An earlier version of this file cross-faded
// two clips by weight on the argument that quantised feedback would ruin the loop, and that
// argument does not survive the delivered animation: adjacent phases differ by 122 and 103
// degrees at the upper arm (0 to 2 is 161). Holding a partial weight blend between poses that
// far apart puts the arm somewhere the animator never authored. A 0.3s transient through that
// midpoint is ordinary animation blending; parking there permanently is not.
const IDLES = ['idle_0', 'idle_1', 'idle_2'];

// Fatigue at which he steps UP a phase, and the lower value at which he drops back. The gap is
// the point: without it, fatigue hovering on a threshold flips the pose every other frame.
const PHASE_UP = [0.35, 0.68];
const PHASE_DOWN = [0.28, 0.60];

const PHASE_FADE = 0.3;

// How far he stands from the pillar in each phase, in document units, positive being toward it
// (screen-right). He is not planted on one spot as he tires: fresh, he holds it at arm's length;
// once he is giving out he has been driven onto it. Moving ONTO the pillar rides the cross-fade's
// own linear ramp, over exactly PHASE_FADE, so the stance is at the same fraction as the pose on
// every frame and not merely at its ends. Moving AWAY from it is instant — see _updateState for
// why the two directions differ.
//
// Written as three plain distances rather than multiples of a base unit, because they are tuned
// by eye per phase and no ratio between them survived that. For scale: he is ~200 units tall and
// the pillar travels 58 in total.
//
// Phase 2 has the most room of the three despite being nearest: the tired poses draw his hands
// in toward his chest, so what would touch the pillar first is idle_0's outstretched arms — and
// that one stands off at -8. Judge the ceiling against whichever pose reaches furthest, not
// against whichever number is largest.
const PHASE_OFFSET = [-8, 14, 36];

// He plays `push` while he is winning ground — i.e. while fatigue is falling, which only
// happens when the player has cleared plates and the shaft is draining. Debounced at both ends
// because a raw per-frame derivative strobes: a tenth of a second of real progress to start,
// and three tenths of nothing to give up.
const GAIN_ENTER = 0.1;
const GAIN_LEAVE = 0.3;

// How far in front of the rig an overlay quad sits. He is ~200 document units tall and about a
// fifth of that deep, and his group is centred on z=0, so anything past a couple of hundred is
// clear of him — the camera is orthographic, so depth costs nothing in perspective.
const OVERLAY_Z = 500;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export async function create({ modelUrl, textureUrl, canvas, DESIGN_W, DESIGN_H, height = 200 }) {
  if (!modelUrl || !canvas) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    console.warn('[hero3d] WebGL unavailable — keeping the 2D placeholder', e);
    return null;
  }

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(modelUrl);
  } catch (e) {
    console.warn('[hero3d] rig failed to load — keeping the 2D placeholder', e);
    renderer.dispose();
    return null;
  }

  // The GLB ships with no image, so this is not optional decoration — without it he is a grey
  // statue. Loaded separately rather than embedded because the same atlas costs 163 KB as an
  // embedded PNG and 9 KB as the WebP already in the repo.
  let texture = null;
  if (textureUrl) {
    try {
      texture = await new THREE.TextureLoader().loadAsync(textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      // glTF UVs have their origin at the top left; TextureLoader defaults the other way.
      // On a palette atlas this is not a subtle error — every strip samples a different colour.
      texture.flipY = false;
      // No mipmaps, deliberately. The atlas is ~30 vertical colour strips across 512px, so a
      // strip is ~17px wide; by mip level 3 neighbouring strips have been averaged together and
      // the character wears colours that are in no palette entry.
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    } catch (e) {
      console.warn('[hero3d] palette atlas failed to load — the rig will render untextured', e);
    }
  }

  return new Hero3D({ gltf, texture, renderer, DESIGN_W, DESIGN_H, height });
}

class Hero3D {
  constructor({ gltf, texture, renderer, DESIGN_W, DESIGN_H, height }) {
    this.W = DESIGN_W;
    this.H = DESIGN_H;
    this.renderer = renderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(DESIGN_W, DESIGN_H, false);
    this.renderer.setClearAlpha(0);
    this.texture = texture;

    this.scene = new THREE.Scene();

    // Orthographic: no perspective divide, so the rig sits in the composition exactly where the
    // layout puts it and never shifts with distance. The frustum is a placeholder until
    // setViewport lands — it is only correct for a square viewport.
    this.camera = new THREE.OrthographicCamera(0, DESIGN_W, DESIGN_H, 0, -2000, 2000);
    this.scene.add(this.camera);

    // Two lights, no shadows. The scene is lit flat by design — the board behind is 2D art,
    // and a shadowed character sitting on unshadowed art reads as a sticker.
    this.scene.add(new THREE.HemisphereLight(0xffe6c4, 0x2a1c10, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-0.5, 1, 2);
    this.scene.add(key);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const model = gltf.scene;
    this.group.add(model);
    this.model = model;

    if (texture) {
      model.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          m.map = texture;
          // baseColorFactor is 0.8 grey in the export and multiplies the map, so leaving it
          // would ship every colour 20% dark.
          m.color?.setScalar(1);
          m.needsUpdate = true;
        }
      });
    }

    // Scale by measured height so the rig matches the 2D placeholder's footprint whatever units
    // it was exported in, and sit its feet on y=0 within the group.
    //
    // Measured off the named body node rather than the whole scene. A rig export can carry
    // control widgets and helpers parked far from the character — this one's sat up at y=18.5
    // against a 2.04u body before they were stripped — and any of them inside the bounding box
    // inflates size.y and collapses the character to a speck.
    // Turned before measuring, so the box describes the silhouette we will actually see and the
    // centring below lands on the axis that ends up horizontal on screen.
    model.rotation.y = FACING_YAW;
    this.group.updateMatrixWorld(true);

    // Two names because two exports: the first rig called its mesh `body_placeholder`, hero2
    // calls it `body`. Falling through to the whole model is the last resort and a bad one —
    // that is the case the note above is about.
    const body = model.getObjectByName('body')
      ?? model.getObjectByName('body_placeholder')
      ?? model;
    const box = new THREE.Box3().setFromObject(body);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? height / size.y : 1;
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    model.position.x = -((box.min.x + box.max.x) / 2) * scale;

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);

    const missing = CLIPS.filter((n) => !this.actions[n]);
    if (missing.length) {
      console.warn(`[hero3d] rig is missing clips: ${missing.join(', ')} — ` +
        `found: ${Object.keys(this.actions).join(', ') || '(none)'}`);
    }

    this._fatigue = 0;
    this._prevFatigue = 0;
    this._phase = 0;
    this._gaining = false;
    this._fallFor = 0;
    this._flatFor = 0;
    this._current = null;   // the looping clip currently faded in
    this._oneShot = null;   // set while land/rope owns the body
    this._placeX = 0;       // last spot the caller asked for, before the phase standoff
    this._placeY = 0;
    this._offset = PHASE_OFFSET[0];
    // The standoff ramp, parked at its end so he starts planted rather than sliding into place.
    this._offsetFrom = PHASE_OFFSET[0];
    this._offsetT = PHASE_FADE;
    this._overlays = [];    // flat chamber pieces lifted up here to draw in front of him

    this._fadeTo(IDLES[0], 0);
  }

  // The Pixi world is cover-scaled and centred by Layout; this canvas is stretched over the
  // whole viewport by CSS. Driving the frustum from the same edges is what makes the two agree
  // at any aspect ratio — without it they only line up on a square screen.
  setViewport(layout) {
    // worldEdges, not edges: the camera's view of the document, so an intro zoom moves the rig
    // and the painted chamber together. At zoom 1 the two are the same rect.
    const e = layout.worldEdges;
    const c = this.camera;
    this.renderer.setSize(layout.vw, layout.vh, false);
    c.left = e.left;
    c.right = e.right;
    c.top = this.H - e.top;        // document y grows downward, Three's grows up
    c.bottom = this.H - e.bottom;
    c.updateProjectionMatrix();
  }

  // 0..1 — how far gone he is. Driven from board `push`, the same number as the stamina ring,
  // so the two can never disagree about how he is doing.
  setFatigue(v) {
    this._fatigue = clamp01(v);
  }

  // Pixi coordinates in, Three coordinates out. footY is the ground line, as in hero.js.
  // The caller's x is where he is *braced*; the phase standoff is added on top of it here so
  // callers never have to know about it.
  place(x, footY) {
    this._placeX = x;
    this._placeY = footY;
    this._applyPlacement();
  }

  _applyPlacement() {
    this.group.position.set(this._placeX + this._offset, this.H - this._placeY, 0);
  }

  // Where he actually stands, in document units — the caller's x plus the phase standoff that
  // place() folded in. Anything that has to line up with him needs this and not the x it passed.
  get worldX() {
    return this._placeX + this._offset;
  }

  // Which of the three exhaustion phases he is in — 0, 1 or 2, indexing IDLES. Exposed so the
  // HUD can colour itself off the SAME number that picks the pose, rather than thresholding
  // fatigue a second time: two copies of PHASE_UP/PHASE_DOWN would have to carry two copies of
  // the hysteresis state as well, and the first person to retune one of them would silently
  // desync the ring from the man.
  get phase() {
    return this._phase;
  }

  // Where his hands actually are, in document coordinates, read straight off the posed skeleton.
  // The alternative is to reassemble it from the braced x, the standoff and the pillar's push,
  // which goes stale the moment any of the three is retuned — and all three have been.
  //
  // Only meaningful once the rope clip has the body; before that his hands are on the pillar.
  // Safe to call before the mixer has run: getWorldPosition updates the ancestor matrices.
  handPoint() {
    if (this._hand === undefined) {
      this._hand = null;
      this.model.traverse((o) => {
        if (!this._hand && norm(o.name).endsWith(HAND_BONE)) this._hand = o;
      });
      if (!this._hand) console.warn('[hero3d] no hand bone — the outro rope has nothing to hold');
    }
    if (!this._hand) return null;
    this._hand.getWorldPosition(_v);
    return { x: _v.x, y: this.H - _v.y };   // Three's +Y is up, the document's is down
  }

  // A flat piece of the chamber, lifted out of Pixi and into this layer so that it can draw IN
  // FRONT of him. Pixi cannot do it at any depth: #three-canvas sits above #pixi-holder, so the
  // whole display list passes under the rig however it is ordered.
  //
  // `rect` is a document-space box, the same units place() takes. `clipLeft` cuts everything
  // left of a document x — for the spikes that is the wall's face, which is what keeps the
  // overlay to exactly the part of a rod that has emerged, and keeps it from covering the
  // socket plate that is still down in Pixi.
  //
  // The texture loads async and the quad simply appears when it arrives; nothing waits on it.
  addOverlay({ url, rect, clipLeft = null, z = OVERLAY_Z }) {
    if (!url) return null;
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      // It is the frontmost thing in the scene and it has soft edges; writing depth would only
      // give it something to occlude itself with.
      depthWrite: false,
    });
    if (clipLeft !== null) {
      this.renderer.localClippingEnabled = true;
      // Keeps the half-space where x >= clipLeft: Three keeps the positive side of normal·p + c.
      material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -clipLeft)];
    }

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.h), material);
    const homeX = rect.x + rect.w / 2;
    mesh.position.set(homeX, this.H - (rect.y + rect.h / 2), z);
    this.scene.add(mesh);
    this._overlays.push(mesh);

    return {
      setOffsetX: (dx) => { mesh.position.x = homeX + dx; },
      // It shares the canvas with the rig, so it shares the rig's problem: every Pixi overlay
      // passes under it. The end card takes it off the same way it takes him off.
      setOpacity: (a) => { material.opacity = a; mesh.visible = a > 0; },
    };
  }

  // Fading the canvas is the cheap way to fade him, and it is what this did while the layer held
  // nothing but the hero. Once something else is up here — the spike tips — the canvas is shared
  // and fading it would take the trap off screen with the man. So the moment an overlay exists,
  // the fade moves onto his own materials instead.
  setOpacity(a) {
    if (!this._overlays.length) {
      this.renderer.domElement.style.opacity = a >= 1 ? '' : String(a);
      return;
    }
    this.model.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.transparent = a < 1;
        m.opacity = a;
      }
    });
  }

  // One-shots: `land` for the intro, `rope` for the escape. `hold` keeps the last frame instead
  // of handing the body back to the idle machine — right for the escape, wrong for the landing.
  // `startAt` and `timeScale` exist for clips whose authored pacing does not fit the beat.
  playOnce(name, { fade = 0.2, hold = false, startAt = 0, timeScale = 1 } = {}) {
    const a = this.actions[name];
    if (!a) return Promise.resolve();

    this._oneShot = name;
    this._current = null;
    for (const [n, other] of Object.entries(this.actions)) {
      if (n !== name) other.fadeOut(fade);
    }
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.enabled = true;
    a.setEffectiveTimeScale(timeScale);
    a.setEffectiveWeight(1);   // see _fadeTo: fadeIn scales this, it does not set it
    a.time = startAt;          // after reset(), which rewinds to 0
    a.play();
    if (fade > 0) a.fadeIn(fade);

    return new Promise((resolve) => {
      const done = (e) => {
        if (e.action !== a) return;
        this.mixer.removeEventListener('finished', done);
        if (!hold && this._oneShot === name) this._oneShot = null; // idle machine takes over
        resolve();
      };
      this.mixer.addEventListener('finished', done);
    });
  }

  // Hand the body back to the phase machine after a held one-shot.
  resumeLoop() {
    this._oneShot = null;
    // ...and release a held pose, if the outro left one on. The fatigue history goes with it:
    // it stopped being updated while held, so a stale _prevFatigue would read the new round's
    // first frame as a collapse and drop him straight into `push`.
    this._held = false;
    this._prevFatigue = this._fatigue;
    this._fallFor = 0;
    this._flatFor = 0;
    this._gaining = false;
  }

  // Freeze the body where it stands, without stopping anything being fed to it.
  //
  // For the outro. The win takes away the pillar he is braced against, so `push` decays to
  // nothing over the next second or so — and the phase machine reads that, correctly, as a man
  // recovering: it walks him back up through idle_1 to idle_0, three cross-fades of him standing
  // off and relaxing, played out while the way is opening and the rope is coming down. Nobody
  // wants to watch him get his breath back; they want him to leave.
  //
  // Held, he keeps the strained pose he escaped in until the rope clip takes the body off him.
  // `playOnce` is unaffected — a one-shot can always claim the body — so this is only ever a
  // freeze of the IDLE selection and the phase standoff that goes with it.
  holdPose(on = true) {
    this._held = on;
  }

  // Fade one looping clip in and everything else out. Written as fade-in/fade-out rather than
  // crossFadeTo so that an interruption mid-fade — which happens whenever fatigue crosses a
  // threshold while he is already changing pose — cannot strand an action at a stale weight.
  _fadeTo(name, fade = PHASE_FADE) {
    if (name === this._current) return;
    const next = this.actions[name];
    if (!next) return;

    for (const [n, other] of Object.entries(this.actions)) {
      if (n !== name) other.fadeOut(fade);
    }
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    // Base weight 1, ALWAYS — fadeIn schedules an interpolant that MULTIPLIES this, it does not
    // assign it. Setting 0 here and fading in leaves the product at zero for good: the mixer
    // then applies nothing, the model sits in its bind pose, and because a zero-weight action
    // never binds its tracks there is no warning either. Silent, and it looks like a dead rig.
    next.setEffectiveWeight(1);
    next.play();
    if (fade > 0) next.fadeIn(fade);

    this._current = name;
  }

  _updateState(dt) {
    // Frozen by the outro — see holdPose. Placement is still applied every frame by place(),
    // which the caller calls from its own update, so there is nothing to do here but stop.
    if (this._held) return;

    const f = this._fatigue;
    const falling = f < this._prevFatigue - 1e-5;
    this._prevFatigue = f;

    if (falling) {
      this._fallFor += dt;
      this._flatFor = 0;
    } else {
      this._flatFor += dt;
      this._fallFor = 0;
    }
    if (!this._gaining && this._fallFor >= GAIN_ENTER) this._gaining = true;
    else if (this._gaining && this._flatFor >= GAIN_LEAVE) this._gaining = false;

    let p = this._phase;
    while (p < PHASE_UP.length && f >= PHASE_UP[p]) p++;
    while (p > 0 && f < PHASE_DOWN[p - 1]) p--;
    if (p !== this._phase) {
      const target = PHASE_OFFSET[p];
      // THE TWO DIRECTIONS ARE NOT THE SAME PROBLEM, so they do not get the same treatment.
      //
      // Stepping DOWN — recovering, idle_2 to idle_1 — he must move AWAY from the pillar, and
      // the pose he is fading into reaches further than the one he is leaving: the tired poses
      // draw his hands into his chest, the fresher ones put them out. Ramp that and for the whole
      // of PHASE_FADE he is standing at the tired distance with lengthening arms, which puts his
      // hands through the stone. It is also the most watched moment in the round, because it is
      // the one the player earned. So it SNAPS: the body is clear before the arms arrive.
      //
      // Stepping UP he is being driven onto the pillar, his hands are drawing in, and nothing can
      // penetrate anything. That one still rides the cross-fade, which is what sells being pushed.
      //
      // The cost of the snap is the mirror of what it fixes — for a few frames his hands are
      // short of the pillar rather than inside it — and that is the right way round: a man
      // bracing slightly off the stone reads as a man bracing. A hand inside it reads as a bug.
      if (target < this._offset) {
        this._offsetFrom = target;
        this._offsetT = PHASE_FADE;   // i.e. already arrived
      } else {
        // From wherever he actually is, so a change that interrupts a move continues from the
        // current position rather than jumping back to the old phase's mark.
        this._offsetFrom = this._offset;
        this._offsetT = 0;
      }
    }
    this._phase = p;

    if (!this._oneShot) this._fadeTo(this._gaining ? 'push' : IDLES[p]);

    // THE STANDOFF RIDES THE CROSS-FADE'S OWN CURVE. Linear, over exactly PHASE_FADE, because
    // that is what the mixer does to the pose weights — fadeIn/fadeOut are linear interpolants
    // over the same PHASE_FADE. Matching them means the two are at the SAME fraction on every
    // frame in between, not merely at the ends, and that is the whole point.
    //
    // This used to be an exponential smooth, `_offset += (target - _offset) * dt / PHASE_FADE`,
    // which is a different curve entirely: it is only 64% of the way after PHASE_FADE and needs
    // about 0.9s to arrive — three times as long as the pose it was supposed to travel with. The
    // symptom was on the way DOWN a phase. The pose became idle_0, whose arms are the furthest
    // outstretched of the three, while the body was still standing at phase 1's closer mark, so
    // his hands went into the pillar and then drew back out as the offset crept away behind them.
    // Judge any change here against idle_0's reach, as PHASE_OFFSET's own note says.
    this._offsetT = Math.min(PHASE_FADE, this._offsetT + dt);
    const k = PHASE_FADE > 0 ? this._offsetT / PHASE_FADE : 1;
    this._offset = this._offsetFrom + (PHASE_OFFSET[p] - this._offsetFrom) * k;
    this._applyPlacement();
  }

  update(dt) {
    this._updateState(dt);
    this.mixer.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.mixer.stopAllAction();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    this.texture?.dispose();
    this.renderer.dispose();
  }
}
