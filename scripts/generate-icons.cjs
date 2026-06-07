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

  // Helper to generate a square PNG with white background and centered SVG logo
  const generatePng = async (filename, size, svgSize) => {
    const outputPath = path.join(publicDir, filename);
    const top = Math.round((size - svgSize) / 2);
    const left = Math.round((size - svgSize) / 2);

    const svgResized = await sharp(svgBuffer)
      .resize(svgSize, svgSize)
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
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

  // Generate different resolutions
  await generatePng('favicon-48.png', 48, 38);
  await generatePng('favicon-192.png', 192, 150);
  await generatePng('favicon-512.png', 512, 400);
  await generatePng('apple-touch-icon.png', 180, 140);

  console.log('All icons generated successfully with clean solid white background!');
}

generate().catch(console.error);
