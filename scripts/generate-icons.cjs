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

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: isMaskable ? 1 : 0 } // maskable使用白底，其它使用透明底！
      }
    })
    .composite([{
      input: svgResized,
      top: top,
      left: left
    }])
    .png()
    .toFile(outputPath);

    console.log(`Generated: ${outputPath} (${size}x${size}, logo scale ${svgSize}x${svgSize}, maskable: ${isMaskable})`);
  };

  // 1. 生成标准的透明底最大化图标 (PC端桌面及标签页使用，彻底消除大白框)
  await generatePng('favicon-48-v16.png', 48, 48, false);
  await generatePng('favicon-192-v16.png', 192, 192, false);
  await generatePng('favicon-512-v16.png', 512, 512, false);
  await generatePng('apple-touch-icon-v16.png', 180, 180, false);

  // 2. 生成专用的手机端白底安全区 PWA Maskable 图标 (防止手机圆形剪裁溢出)
  await generatePng('favicon-maskable-192-v16.png', 192, 150, true);
  await generatePng('favicon-maskable-512-v16.png', 512, 400, true);

  console.log('All icons generated successfully for dual profiles (PC transparent & Mobile maskable)!');
}

generate().catch(console.error);
