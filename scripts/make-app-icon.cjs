// One-off asset build step -- rasterizes the existing favicon.svg mark into a
// square, padded, transparent PNG (assets/logo.png) sized for
// @capacitor/assets' Easy Mode, which then composites it onto the app's
// theme background color to generate the actual iOS icon/splash sizes. Not
// part of the app build; run manually only when the source mark changes.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function main() {
  const svgPath = path.join(__dirname, "..", "public", "favicon.svg");
  const outDir = path.join(__dirname, "..", "assets");
  const outPath = path.join(outDir, "logo.png");
  fs.mkdirSync(outDir, { recursive: true });

  const CANVAS = 1024;
  const MARK_HEIGHT = 620; // leaves generous padding so the mark reads clearly once composited onto an icon background

  const markBuffer = await sharp(svgPath, { density: 2400 })
    .resize({ height: MARK_HEIGHT, fit: "inside" })
    .png()
    .toBuffer();

  const markMeta = await sharp(markBuffer).metadata();
  const left = Math.round((CANVAS - markMeta.width) / 2);
  const top = Math.round((CANVAS - markMeta.height) / 2);

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: markBuffer, left, top }])
    .png()
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
