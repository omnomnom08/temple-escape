import * as PIXI from 'pixi.js';
import { Game } from './game.js';
import { Layout } from './layout.js';
import { VOID_COLOR } from './scene.js';

// The renderer fills the viewport and the world is scaled/positioned inside it by Layout.
// It deliberately does NOT render at a fixed design resolution and letterbox: the art is
// authored on a square canvas so the backdrop can cover both portrait and landscape, and a
// fixed box would throw that away and band the screen in landscape.

// EVERYTHING async lives inside start(). Do NOT hoist these awaits to the top level.
//
// vite-plugin-singlefile inlines the whole app into one module, which turns Pixi's internal
// `import('./browserAll.mjs')` into a self-reference resolved by a microtask. With a
// top-level await the module body is still suspended when that microtask runs, so Pixi
// reaches for `browserAll` before its `const` has initialised and the build dies with
// "Cannot access 'browserAll' before initialization" — a black screen. Calling start()
// without awaiting lets the module body finish evaluating first.
// This only ever bites the production bundle; `npm run dev` serves real ES modules and
// resolves the import properly, which is how it went unnoticed for weeks.
async function start() {
  // Optional ad-network SDK. Loaded defensively so the demo also runs standalone.
  let sdk = null;
  try {
    ({ sdk } = await import('@smoud/playable-sdk'));
  } catch (e) {
    console.info('[playable] @smoud/playable-sdk not present — running standalone.');
  }

  const pixiApp = new PIXI.Application();
  await pixiApp.init({
    width: window.innerWidth,
    height: window.innerHeight,
    background: VOID_COLOR,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    // autoDensity keeps the canvas CSS size at the logical size while the backing store stays
    // high-resolution. Without it, a 2x display renders everything double-size and clipped —
    // and headless capture runs at dpr 1, so this class of bug is invisible there.
    autoDensity: true,
  });
  document.getElementById('pixi-holder').appendChild(pixiApp.canvas);

  const layout = new Layout();
  const game = new Game({ pixiApp, layout, sdk });

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    layout.resize(vw, vh);
    pixiApp.renderer.resize(vw, vh);
    game.layoutChanged();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    game.build().then(fit); // re-anchor once the scene exists
  }

  if (sdk && typeof sdk.init === 'function') {
    try {
      sdk.init(() => boot());
      if (sdk.on) {
        sdk.on('retry', () => game.reset());
        sdk.on('resize', () => fit());
        sdk.on('volume', (v) => game.setVolume?.(v));
      }
    } catch (e) {
      boot();
    }
  }
  // Fallback so the demo always starts when opened directly in a browser.
  setTimeout(boot, 500);

  pixiApp.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    game.update(dt);
  });
}

start();
