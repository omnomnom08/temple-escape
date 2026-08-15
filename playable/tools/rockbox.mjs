// How much of a rock sprite frame is actually opaque? The pack grid spaces rocks by their
// frame box, but the eye only sees the painted pixels — if the art has generous padding the
// mass reads as gappy even when the cells are touching.
import path from 'node:path';
import sharp from 'sharp';

const ART = path.resolve(import.meta.dirname, '../../assets/art');

for (const f of ['rock01', 'rock02', 'rock03', 'rock04']) {
  const src = path.join(ART, `${f}_spritesheet.png`);
  const img = sharp(src);
  const { width, height } = await img.metadata();
  const frameW = height; // 13 square frames across
  const { data, info } = await sharp(src)
    .extract({ left: 0, top: 0, width: frameW, height })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  console.log(`${f}: sheet ${width}x${height}, frame ${frameW}px, opaque ${w}x${h} -> fills ${(100 * w / frameW).toFixed(0)}% x ${(100 * h / height).toFixed(0)}%`);
}
