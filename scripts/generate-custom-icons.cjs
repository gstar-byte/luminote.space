const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourcePngPath = path.join(__dirname, '..', 'public', 'favicon-512-v15.png');
const sourceSvgPath = path.join(__dirname, '..', 'public', 'pwa-logo.svg');

const publicDir = path.join(__dirname, '..', 'public');
const mobileDir = path.join(__dirname, '..', 'mobile', 'assets', 'images');

async function main() {
  if (!fs.existsSync(sourcePngPath)) {
    console.error(`Source PNG icon not found at ${sourcePngPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(sourceSvgPath)) {
    console.error(`Source SVG icon not found at ${sourceSvgPath}`);
    process.exit(1);
  }

  // 确保目标目录存在
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  if (!fs.existsSync(mobileDir)) {
    fs.mkdirSync(mobileDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(sourceSvgPath);

  // --- 辅助函数 1：用 SVG（正放）为 Web/PWA 生成图标 ---
  const makeSvgTransparentIcon = async (destDir, filename, size) => {
    const outputPath = path.join(destDir, filename);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ palette: true, quality: 90, compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`Generated Web transparent icon (from SVG): ${filename} (${size}x${size})`);
  };

  const makeSvgSolidBgIcon = async (destDir, filename, canvasSize, iconSize, bgColor) => {
    const outputPath = path.join(destDir, filename);
    
    // 缩放 SVG 
    const resizedIconBuf = await sharp(svgBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    const top = Math.round((canvasSize - iconSize) / 2);
    const left = Math.round((canvasSize - iconSize) / 2);

    await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: bgColor
      }
    })
    .composite([{
      input: resizedIconBuf,
      top: top,
      left: left
    }])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(outputPath);

    console.log(`Generated Web solid bg icon (from SVG): ${filename} (${canvasSize}x${canvasSize}, icon: ${iconSize}x${iconSize})`);
  };

  // --- 辅助函数 2：用 PNG（倾斜 + trim）为 Native 移动端生成图标 ---
  const makePngTransparentIcon = async (destDir, filename, size) => {
    const outputPath = path.join(destDir, filename);
    await sharp(sourcePngPath)
      .trim()
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ palette: true, quality: 90, compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`Generated Mobile transparent icon (from PNG): ${filename} (${size}x${size})`);
  };

  const makePngSolidBgIcon = async (destDir, filename, canvasSize, iconSize, bgColor) => {
    const outputPath = path.join(destDir, filename);
    
    const resizedIconBuf = await sharp(sourcePngPath)
      .trim()
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    const top = Math.round((canvasSize - iconSize) / 2);
    const left = Math.round((canvasSize - iconSize) / 2);

    await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: bgColor
      }
    })
    .composite([{
      input: resizedIconBuf,
      top: top,
      left: left
    }])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(outputPath);

    console.log(`Generated Mobile solid bg icon (from PNG): ${filename} (${canvasSize}x${canvasSize}, icon: ${iconSize}x${iconSize})`);
  };

  // --- A. 生成 Web / PWA 目标图标 (全部为不倾斜、正向、顶格、右下折页的 PWA 图标) ---
  await makeSvgTransparentIcon(publicDir, 'favicon-48-v18.png', 48);
  await makeSvgTransparentIcon(publicDir, 'favicon-192-v18.png', 192);
  await makeSvgTransparentIcon(publicDir, 'favicon-512-v18.png', 512);
  await makeSvgTransparentIcon(publicDir, 'favicon-48.png', 48);
  await makeSvgTransparentIcon(publicDir, 'favicon-192.png', 192);

  // 苹果主屏幕图标 & Maskable 图标 (铺淡黄色背景 #FFFBE6)
  await makeSvgSolidBgIcon(publicDir, 'apple-touch-icon-v18.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSvgSolidBgIcon(publicDir, 'apple-touch-icon.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSvgSolidBgIcon(publicDir, 'apple-touch-icon-v15.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });

  await makeSvgSolidBgIcon(publicDir, 'favicon-maskable-192-v18.png', 192, 150, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSvgSolidBgIcon(publicDir, 'favicon-maskable-512-v18.png', 512, 400, { r: 255, g: 251, b: 230, alpha: 1 });

  // --- B. 生成 Native 移动端目标图标 与 PWA 启动屏 (全部保持倾斜，使用带有 .trim() 裁切的 favicon-512-v15.png) ---
  await makePngSolidBgIcon(publicDir, 'pwa-splash.png', 1024, 380, { r: 255, g: 255, b: 255, alpha: 1 });
  await makePngSolidBgIcon(mobileDir, 'icon.png', 1024, 680, { r: 255, g: 255, b: 255, alpha: 1 });
  await makePngSolidBgIcon(mobileDir, 'android-icon-foreground.png', 1024, 680, { r: 255, g: 255, b: 255, alpha: 0 });

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .png({ palette: true, quality: 90 })
  .toFile(path.join(mobileDir, 'android-icon-background.png'));
  console.log(`Generated solid bg icon background: android-icon-background.png`);

  await makePngTransparentIcon(mobileDir, 'splash-icon.png', 200);
  await makePngTransparentIcon(mobileDir, 'favicon.png', 48);

  console.log('Dual-mode PWA (straight) & Native (slanted) icons built successfully!');
}

main().catch(console.error);
