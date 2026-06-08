const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'pwa-logo.svg');
const publicDir = path.join(__dirname, '..', 'public');

async function generate() {
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG logo not found at ${svgPath}`);
    return;
  }
  const svgBuffer = fs.readFileSync(svgPath);

  // Helper to generate a square PNG with transparent/white background and centered SVG logo
  const generatePng = async (filename, size, svgSize, isMaskable = false) => {
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

    // 针对 Maskable 和 Apple Touch Icon 采用不透明淡黄色底 (#FFFBE6)
    const isAppleTouch = filename.includes('apple-touch-icon');
    const isSolidBackground = isMaskable || isAppleTouch;

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: isSolidBackground 
          ? { r: 255, g: 251, b: 230, alpha: 1 } // 使用与便签纸底色契合的优雅淡黄色
          : { r: 255, g: 255, b: 255, alpha: 0 } // 普通 favicon 维持透明底
      }
    })
    .composite([{
      input: svgResized,
      top: top,
      left: left
    }])
    .png({ palette: true, quality: 85, compressionLevel: 9 })
    .toFile(outputPath);

    console.log(`Generated: ${outputPath} (${size}x${size}, logo scale ${svgSize}x${svgSize}, solidBg: ${isSolidBackground})`);
  };

  // 1. 生成标准的透明底最大化图标 (PC端及移动端 standard favicon 使用)
  await generatePng('favicon-48-v17.png', 48, 48, false);
  await generatePng('favicon-192-v17.png', 192, 192, false);
  await generatePng('favicon-512-v17.png', 512, 512, false);

  // 2. 生成专用的 Apple Touch Icon (为 iOS 手机添加主屏幕适配，留出一定呼吸安全区，并使用淡黄底)
  await generatePng('apple-touch-icon-v17.png', 180, 140, false);

  // 3. 生成专用的手机端白底安全区 PWA Maskable 图标 (防止手机圆形剪裁溢出)
  await generatePng('favicon-maskable-192-v17.png', 192, 150, true);
  await generatePng('favicon-maskable-512-v17.png', 512, 400, true);

  console.log('All icons generated successfully for dual profiles (PC transparent & Mobile solid-yellow)!');
}

generate().catch(console.error);

