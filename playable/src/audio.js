// Audio. Deliberately the Web Audio API directly rather than a library — the whole surface
// needed here is "decode a few buffers, play them with a gain, and hold two loops", and a
// sound library would cost more bundle than the clips do.
//
// Four things this has to get right in an ad context:
//
//  1. AUTOPLAY. Browsers refuse to start an AudioContext without a gesture, so it is created
//     suspended and resumed on the first tap. Nothing before that is lost — it is just silent.
//     The music bed starts on that same gesture rather than at boot, for the same reason.
//  2. RUBBLE IS GATED ON FLOW, NOT IMPACTS. A rumble triggered per rock collision either
//     machine-guns or needs throttling. Here it is a LOOP whose gain follows how much mass is
//     moving, which is one number, and it sounds like rock instead of like popcorn.
//  3. REPEATED SOUNDS MUST VARY. The same match sample fired six times in a cascade reads as
//     a glitch, so matches pitch up a semitone per cascade step.
//  4. NOTHING MAY THROW. Every clip is optional; a missing or undecodable file must cost its
//     own sound and nothing else.
//
// Explicit imports, not a glob over the folder: a glob bundles every file it matches whether
// or not it is ever played, and mp3 inlined into a single-file creative is expensive. Every
// clip in assets/audio is used below, so the folder and the bank are in sync — if a sound is
// added, it has to be given a job here before it costs anything.
import merge0 from '../../assets/audio/merge_complete_0.mp3?url';
import merge1 from '../../assets/audio/merge_complete_1.mp3?url';
import merge2 from '../../assets/audio/merge_complete_2.mp3?url';
import merge3 from '../../assets/audio/merge_complete_3.mp3?url';
import merge4 from '../../assets/audio/merge_complete_4.mp3?url';
import merge5 from '../../assets/audio/merge_complete_5.mp3?url';
import bg1 from '../../assets/audio/bg_1.mp3?url';
import doorFall0 from '../../assets/audio/door_fall_0.mp3?url';
import doorLift1 from '../../assets/audio/door_lift_1.mp3?url';
import endcard from '../../assets/audio/endcard.mp3?url';
import stone0 from '../../assets/audio/stone_0.mp3?url';
import stone1 from '../../assets/audio/stone_1.mp3?url';
import stone2 from '../../assets/audio/stone_2.mp3?url';
import stone3 from '../../assets/audio/stone_3.mp3?url';
import stone4 from '../../assets/audio/stone_4.mp3?url';
import timer from '../../assets/audio/timer.mp3?url';
import whoosh from '../../assets/audio/whoosh.mp3?url';
import winSting from '../../assets/audio/win.mp3?url';
import manStruggle from '../../assets/audio/man_struggle.mp3?url';
import manHappy from '../../assets/audio/man_happy.mp3?url';
import heartbeat from '../../assets/audio/heartbeat.mp3?url';

const FILES = {
  merge_complete_0: merge0, merge_complete_1: merge1, merge_complete_2: merge2,
  merge_complete_3: merge3, merge_complete_4: merge4, merge_complete_5: merge5,
  bg_1: bg1,
  door_fall_0: doorFall0,
  door_lift_1: doorLift1,
  endcard,
  stone_0: stone0, stone_1: stone1, stone_2: stone2, stone_3: stone3, stone_4: stone4,
  timer,
  whoosh,
  win: winSting,
  man_struggle: manStruggle,
  man_happy: manHappy,
  heartbeat,
};

// name -> the clips that may play for it. Arrays round-robin, EXCEPT `match`, which is a
// ladder indexed by cascade depth — see playMatch.
//
// Which stone goes where is measured, not guessed — the clips are sorted by their loudness
// envelope (ffmpeg volumedetect, one-second windows):
//   stone_1  1.4s, gone by the second window   -> the plate letting go, under each match
//   stone_2  4.1s, hard attack, long tail      -> rubble draining out of the shaft
//   stone_3  4.1s, attack then a steady pour   -> as above
//   stone_4  4.1s, the hardest attack          -> as above
//   stone_0  4.7s, three seconds of steady     -> the rumble bed, looped (see LOOPS)
const BANK = {
  // Six clips authored as a rising set, so step N of a cascade is clip N. This is the ladder
  // that used to be faked by pitching one sample up a semitone per step — real recordings beat
  // a playbackRate trick, which thins the sample as it climbs.
  match: ['merge_complete_0', 'merge_complete_1', 'merge_complete_2',
    'merge_complete_3', 'merge_complete_4', 'merge_complete_5'],
  plate: ['stone_1'],
  swap: ['whoosh'],
  invalid: ['door_fall_0'],
  drain: ['stone_2', 'stone_3', 'stone_4'],
  win: ['win'],
  winCheer: ['endcard'],
  door: ['door_lift_1'],
  fail: ['door_fall_0'],
  // The man himself. These are the only two sounds in the round that come from HIM rather than
  // from stone, so they are mixed to sit on top of the bed instead of inside it.
  struggle: ['man_struggle'],   // he loses a stamina phase — see playStruggle
  ropeGrab: ['man_happy'],      // he gets a hand on the rope
  // Deliberately NOT in LOOPS, even though it repeats for as long as the panic lasts. The three
  // loops below are BEDS, held open because re-attacking their first frame would click. This one
  // is a RHYTHM: one lub-dub, at 0.04s and 0.30s, silent from 0.815s to its end. Re-attacking is
  // the whole point of it, and firing it as a one-shot is what lets the caller put the red frame's
  // pulse on the same clock — see the game's panic timeline.
  heartbeat: ['heartbeat'],
};

// Sounds that are held rather than fired. Each is one BufferSource that starts when the
// context unlocks and runs for the whole session; what changes is its gain. Starting and
// stopping sources instead would click, and would re-attack the loop's first frame every time.
const LOOPS = {
  music: { clip: 'bg_1', volume: 0.28 },
  rumble: { clip: 'stone_0', volume: 0 },   // driven by setFlow
  danger: { clip: 'timer', volume: 0 },     // driven by setDanger
};

// The rumble bed's levels. It is a bed under the whole round, not an effect, so it has to sit
// well below the one-shots: the rocks are meant to be felt continuously and noticed only when
// something big moves. RUMBLE_FULL is the rock count that counts as a full avalanche — the sim
// reports a headcount of fast-falling rocks, and 10 is its floor for reporting at all.
const RUMBLE_MAX = 0.20;
const RUMBLE_FLOOR = 0.03;
const RUMBLE_FULL = 160;
const RUMBLE_TAIL = 1.3;   // seconds to silence, if no further flow is reported

// How long a gap in matching drops the merge ladder back to its bottom rung. Longer than a
// cascade takes to play out (~0.5s a step) so a chain never resets in the middle of itself,
// short enough that a fresh look at the board starts the climb again.
const MERGE_RESET = 2.5;

// The shortest gap allowed between two grunts. The clip is 1.38s and it is a voice: two of them
// overlapping is one man twice, which is worse than a missed cue. Comfortably longer than the
// clip, so a second phase loss during the first grunt is dropped rather than stacked.
const STRUGGLE_GAP = 2.0;

const urlFor = (base) => FILES[base] ?? null;

export class Audio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.buffers = new Map();
    this.cursors = new Map();
    this.loops = new Map();
    this._flow = 0;
    this._mergeStep = 0;
    this._lastMatchT = -Infinity;
    this._lastStruggleT = -Infinity;
  }

  // Created suspended; the first user gesture resumes it. Safe to call more than once.
  async init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    const wanted = [...new Set([
      ...Object.values(BANK).flat(),
      ...Object.values(LOOPS).map((l) => l.clip),
    ])];
    await Promise.all(wanted.map(async (name) => {
      const url = urlFor(name);
      if (!url) return;
      try {
        const res = await fetch(url);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(name, buf);
      } catch (e) {
        // A missing or undecodable clip must never take the game down with it.
        console.warn(`[audio] could not load ${name}`);
      }
    }));
    this.ready = true;
    if (this.ctx.state === 'running') this._startLoops();
  }

  unlock() {
    if (this.ctx?.state === 'suspended') this.ctx.resume().then(() => this._startLoops());
    else this._startLoops();
  }

  // One source per loop, started once and left running. Idempotent: unlock() can fire on every
  // tap, and init() may finish after the first one.
  _startLoops() {
    if (!this.ready || !this.ctx || this.ctx.state !== 'running') return;
    for (const [key, def] of Object.entries(LOOPS)) {
      if (this.loops.has(key)) continue;
      const buf = this.buffers.get(def.clip);
      if (!buf) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = def.volume;
      src.connect(gain).connect(this.master);
      src.start();
      this.loops.set(key, { src, gain, target: def.volume });
    }
  }

  // Ramp rather than set: a step change in gain on a running loop is an audible click.
  _rampLoop(key, volume, seconds = 0.35) {
    const loop = this.loops.get(key);
    if (!loop) return;
    const now = this.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(volume, now + seconds);
    loop.target = volume;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  play(key, { volume = 1, rate = 1 } = {}) {
    if (!this.ready || this.muted || !this.ctx) return;
    const names = BANK[key];
    if (!names) return;

    // round-robin so a cascade never fires the same sample twice in a row
    const i = (this.cursors.get(key) ?? -1) + 1;
    this.cursors.set(key, i);
    const buf = this.buffers.get(names[i % names.length]);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start();
  }

  // The merge ladder: every match climbs one rung, 0 through 5, and holds at the top. Not
  // indexed by cascade depth — most swaps resolve in a single clear, so that only ever played
  // clip 0 and the other five were never heard.
  //
  // What resets it is a PAUSE, not a move: keep matching and you keep climbing, stop for a
  // couple of seconds and it drops back to the bottom. That is the combo feel the six clips
  // were authored for, and it rewards the exact behaviour the round wants — clearing fast,
  // while the rubble is arriving.
  playMatch() {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this._lastMatchT > MERGE_RESET) this._mergeStep = 0;
    this._lastMatchT = now;

    const names = BANK.match;
    const buf = this.buffers.get(names[Math.min(this._mergeStep, names.length - 1)]);
    this._mergeStep++;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(this.master);
    src.start();
  }

  // The grunt, on the frame he drops a stamina phase. Rate-limited here rather than at the call
  // site because the limit is a property of the CLIP (a voice, 1.38s long) and not of whatever
  // decides he is tiring — the same guard has to hold if the trigger is ever retuned.
  playStruggle() {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastStruggleT ?? -Infinity) < STRUGGLE_GAP) return;
    this._lastStruggleT = now;
    this.play('struggle', { volume: 0.75 });
  }

  // Called by the debris sim with HOW MANY ROCKS are falling fast right now — a count, not a
  // 0..1. It arrives at most every 0.7s (the sim throttles it) and, crucially, it does NOT
  // arrive when the flow stops: the sim only reports above its minimum. So this both swells
  // the bed and schedules its own decay, and silence is what happens when nothing re-triggers
  // it. Reading the count as if it were a fraction is what pinned the rumble at full volume
  // for the whole round.
  setFlow(count) {
    this._flow = count;
    const loop = this.loops.get('rumble');
    if (!loop || this.muted) return;
    const loud = Math.min(RUMBLE_MAX, RUMBLE_FLOOR + (count / RUMBLE_FULL) * RUMBLE_MAX);
    const now = this.ctx.currentTime;
    const g = loop.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(loud, now + 0.12);          // the avalanche starts
    g.linearRampToValueAtTime(0, now + 0.12 + RUMBLE_TAIL); // ...and dies unless it is fed
    loop.target = loud;
  }

  // The HURRY state, as a sound. Same 0..1 the banner reads, so they can never disagree.
  setDanger(on) {
    this._rampLoop('danger', on ? 0.5 : 0, on ? 0.5 : 0.8);
  }

  // The end cards are loud; drop the bed under them rather than stacking everything.
  duckMusic(on) {
    this._rampLoop('music', on ? 0.08 : LOOPS.music.volume, 0.5);
  }
}
