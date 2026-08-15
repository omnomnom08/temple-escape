import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { CTA_URL } from './src/cta.js';

// Ad networks take one self-contained HTML file, so everything — JS, CSS, images, audio —
// is inlined into dist/index.html. That is also why assetsInlineLimit is effectively
// infinite: any emitted side-file would 404 once the creative is served.
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [viteSingleFile()],
  // @smoud/playable-sdk reads its whole configuration from bundler defines rather than from a
  // runtime API — see node_modules/@smoud/playable-sdk/defines.d.ts, which declares them as
  // ambient globals. With none of them supplied, `initSDK` evaluates
  //
  //     destinationUrl = /android/i.test(...) ? GOOGLE_PLAY_URL : APP_STORE_URL
  //
  // against undeclared identifiers, `destinationUrl` stays "", and every branch of `install()`
  // falls through to `window.open("")`. The CTA looked wired up and went nowhere.
  //
  // A network's own build tooling overwrites these when the creative is packaged; they are the
  // preview/standalone values, and the only ones that matter until then.
  define: {
    AD_NETWORK: JSON.stringify('preview'),
    AD_PROTOCOL: JSON.stringify('none'),
    APP_STORE_URL: JSON.stringify(CTA_URL),
    GOOGLE_PLAY_URL: JSON.stringify(CTA_URL),
    BUILD_HASH: JSON.stringify('dev'),
  },
  server: {
    host: true,
    port: 5173,
    open: false,
    // Art and audio live in the delivery's /assets folder, one level above this Vite root
    // (the brief specifies /playable and /assets as siblings). The dev server has to be
    // told it may serve from there; the production build follows the imports regardless.
    fs: { allow: ['..'] },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
