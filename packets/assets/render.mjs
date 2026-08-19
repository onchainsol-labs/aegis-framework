// Generate icon PNGs from assets/icon-vector.svg (the pure-vector version —
// sharp/librsvg can't render color emoji fonts, so the emoji icon.svg is only
// used as the browser favicon).
//
//   cd assets && npm install && npm run generate
//
// Outputs:
//   web/public/            favicon-32/64, apple-touch-icon (180), icon-192/512
//   assets/mobile/         icon-180/192/512

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKETS = path.resolve(HERE, "..");
const out = (p) => path.join(PACKETS, p);

mkdirSync(path.join(PACKETS, "assets/mobile"), { recursive: true });
mkdirSync(path.join(PACKETS, "web/public"), { recursive: true });

const iconSizes = [
  ["web/public/favicon-32.png", 32],
  ["web/public/favicon-64.png", 64],
  ["web/public/apple-touch-icon.png", 180],
  ["web/public/icon-192.png", 192],
  ["web/public/icon-512.png", 512],
  ["assets/mobile/icon-180.png", 180],
  ["assets/mobile/icon-192.png", 192],
  ["assets/mobile/icon-512.png", 512],
  // Production app icons (Expo wants 1024, Android adaptive foreground 432)
  ["assets/mobile/icon-1024.png", 1024],
  ["assets/mobile/android-icon-foreground.png", 432],
];

for (const [rel, size] of iconSizes) {
  await sharp(path.join(HERE, "icon-vector.svg")).resize(size, size).png().toFile(out(rel));
  console.log("✓", rel, `${size}x${size}`);
}

// Android adaptive icons get masked into a circle/squircle, so the mark sits
// on a transparent canvas with ~25% padding instead of full-bleed.
const fg = path.join(PACKETS, "assets/mobile/android-icon-foreground.png");
await sharp({
  create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: await sharp(path.join(HERE, "icon-vector.svg")).resize(320, 320).png().toBuffer(), left: 56, top: 56 }])
  .png()
  .toFile(fg);
console.log("✓", "assets/mobile/android-icon-foreground.png", "432x432 (padded)");

// Android adaptive background: soft cream → gold-soft vertical gradient
// (brand palette — matches the splash and app background).
const bgSvg = `<svg width="432" height="432" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF7EC"/>
      <stop offset="1" stop-color="#FBE3B3"/>
    </linearGradient>
  </defs>
  <rect width="432" height="432" fill="url(#g)"/>
</svg>`;
await sharp(Buffer.from(bgSvg)).png().toFile(out("assets/mobile/android-icon-background.png"));
console.log("✓", "assets/mobile/android-icon-background.png", "432x432 (gradient)");

console.log("done");
