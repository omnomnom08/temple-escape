import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Ad networks take one self-contained HTML file, so everything — JS, CSS, images, audio —
// is inlined into dist/index.html. That is also why assetsInlineLimit is effectively
// infinite: any emitted side-file would 404 once the creative is served.
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [viteSingleFile()],
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
