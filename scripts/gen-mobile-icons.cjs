const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSvg = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paper-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF0"/>
      <stop offset="100%" stop-color="#FEF08A"/>
    </linearGradient>
    <linearGradient id="curl-bg" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EAB308"/>
      <stop offset="40%" stop-color="#FEF08A"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="pill-blue" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="pill-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F97316"/>
      <stop offset="100%" stop-color="#FACC15"/>
    </linearGradient>
  </defs>

  <g transform="rotate(-26, 50, 50)">
    <path d="M18 30 C18 23.3726 23.3726 18 30 18 H70 C76.6274 18 82 23.3726 82 30 V60 L60 82 H30 C23.3726 82 18 76.6274 18 70 Z" fill="url(#paper-bg)"/>
    <rect x="25" y="28" width="6" height="6" rx="1.5" stroke="#EC4899" stroke-width="1.2" fill="none"/>
    <rect x="35" y="28" width="28" height="6" rx="3" fill="#EC4899"/>
    <path d="M75.5 27 L77.1 30.2 L80.6 30.7 L78.0 33.1 L78.6 36.6 L75.5 34.9 L72.4 36.6 L73.0 33.1 L70.4 30.7 L73.9 30.2 Z" fill="#EAB308"/>
    <rect x="25" y="42" width="6" height="6" rx="1.5" fill="url(#pill-blue)"/>
    <path d="M26.5 45 L27.8 46.3 L30 44" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="35" y="42" width="31" height="6" rx="3" fill="url(#pill-blue)"/>
    <path d="M75.5 38.5 C74.2 38.5 73.2 39.8 73.2 41.2 C73.2 42.2 72.2 44.2 71.5 44.8 C71 45.3 71.5 46.2 72.8 46.2 H78.2 C79.5 46.2 80 45.3 79.5 44.8 C78.8 44.2 77.8 42.2 77.8 41.2 C77.8 39.8 76.8 38.5 75.5 38.5 Z" fill="url(#pill-blue)"/>
    <circle cx="75.5" cy="47.2" r="1.1" fill="url(#pill-blue)"/>
    <rect x="25" y="56" width="6" height="6" rx="1.5" stroke="#F97316" stroke-width="1.2" fill="none"/>
    <rect x="35" y="56" width="20" height="6" rx="3" fill="url(#pill-yellow)"/>
    <path d="M60 82 C60 71 71 60 82 60 C71 71 71 82 60 82 Z" fill="url(#curl-bg)"/>
    <path d="M60 82 L82 60" stroke="#EAB308" stroke-opacity="0.3" stroke-width="0.5"/>
  </g>
</svg>`;

const mobileImagesDir = path.join(__dirname, '..', 'mobile', 'assets', 'images');

async function generate() {
  const svgBuf = Buffer.from(iconSvg);

  // Helper to compose a PNG with background color (if provided) and centered SVG logo
  const makeIcon = async (filename, size, svgSize, hasBgColor = false) => {
    const outputPath = path.join(mobileImagesDir, filename);

    const svgResized = await sharp(svgBuf)
      .resize(svgSize, svgSize)
      .toBuffer();

    const channels = 4;
    const background = hasBgColor 
      ? { r: 230, g: 244, b: 254, alpha: 1 } // #E6F4FE
      : { r: 255, g: 255, b: 255, alpha: 0 }; // transparent

    await sharp({
      create: {
        width: size,
        height: size,
        channels: channels,
        background: background
      }
    })
    .composite([{
      input: svgResized,
      top: Math.round((size - svgSize) / 2),
      left: Math.round((size - svgSize) / 2)
    }])
    .png()
    .toFile(outputPath);

    console.log(`Generated mobile icon: ${outputPath} (${size}x${size}, logo scale ${svgSize}x${svgSize}, bg: ${hasBgColor ? '#E6F4FE' : 'transparent'})`);
  };

  // 1. App Icon (1024x1024, hasBgColor = true, background = #E6F4FE)
  // iOS needs an opaque background icon. Let's make it beautiful light-blue background with yellow note logo.
  await makeIcon('icon.png', 1024, 680, true);

  // 2. Android Adaptive Foreground (1024x1024, transparent background, logo within 66% safe area)
  await makeIcon('android-icon-foreground.png', 1024, 680, false);

  // 3. Android Adaptive Background (1024x1024, pure #E6F4FE solid background)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 230, g: 244, b: 254, alpha: 1 } // #E6F4FE
    }
  })
  .png()
  .toFile(path.join(mobileImagesDir, 'android-icon-background.png'));
  console.log('Generated mobile icon background: android-icon-background.png (1024x1024, #E6F4FE)');

  // 4. Splash Icon (200x200, transparent)
  await makeIcon('splash-icon.png', 200, 200, false);

  console.log('All mobile icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating mobile icons:', err);
  process.exit(1);
});
