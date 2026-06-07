const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'app-logo.svg');
const publicDir = path.join(__dirname, '..', 'public');

async function generate() {
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG logo not found at ${svgPath}`);
    return;
  }
  const svgBuffer = fs.readFileSync(svgPath);

  // Helper to generate a square PNG with fully transparent background and centered SVG logo
  const generatePng = async (filename, size, svgSize) => {
    const outputPath = path.join(publicDir, filename);
    const top = Math.round((size - svgSize) / 2);
    const left = Math.round((size - svgSize) / 2);

    const svgResized = await sharp(svgBuffer)
      .trim() // 1. 物理切除 SVG 外部多余的透明留边
      .resize(svgSize, svgSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
    .composite([{
      input: svgResized,
      top: top,
      left: left
    }])
    .png()
    .toFile(outputPath);

    console.log(`Generated: ${outputPath} (${size}x${size}, logo scale ${svgSize}x${svgSize})`);
  };

  // Generate different resolutions with physical cache-bust filenames
  await generatePng('favicon-48-v16.png', 48, 48);
  await generatePng('favicon-192-v16.png', 192, 192);
  await generatePng('favicon-512-v16.png', 512, 512);
  await generatePng('apple-touch-icon-v16.png', 180, 180);

  console.log('All icons generated successfully with transparent background and max scale!');
}

generate().catch(console.error);
