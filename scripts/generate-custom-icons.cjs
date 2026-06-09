const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'public', 'favicon-512-v15.png');
const publicDir = path.join(__dirname, '..', 'public');
const mobileDir = path.join(__dirname, '..', 'mobile', 'assets', 'images');

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source icon not found at ${sourcePath}`);
    process.exit(1);
  }

  // 确保目标目录存在
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  if (!fs.existsSync(mobileDir)) {
    fs.mkdirSync(mobileDir, { recursive: true });
  }

  // 1. 辅助函数：生成纯透明背景的缩放 PNG
  const makeTransparentIcon = async (destDir, filename, size) => {
    const outputPath = path.join(destDir, filename);
    await sharp(sourcePath)
      .trim() // 物理切除源图外部多余的透明留边，压榨最大显示空间
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ palette: true, quality: 90, compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`Generated transparent icon: ${filename} (${size}x${size})`);
  };

  // 2. 辅助函数：生成有背景色铺底，且图标居中缩放的 PNG（用于 PWA maskable、apple-touch-icon 和原生 icon）
  const makeSolidBgIcon = async (destDir, filename, canvasSize, iconSize, bgColor) => {
    const outputPath = path.join(destDir, filename);
    
    // 缩放图标
    const resizedIconBuf = await sharp(sourcePath)
      .trim() // 物理切除源图外部多余的透明留边，保证高占比
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    const top = Math.round((canvasSize - iconSize) / 2);
    const left = Math.round((canvasSize - iconSize) / 2);

    // 创建背景并组合
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

    console.log(`Generated solid bg icon: ${filename} (${canvasSize}x${canvasSize}, icon: ${iconSize}x${iconSize})`);
  };

  // --- Web / PWA 目标生成 ---
  // A. 透明底
  await makeTransparentIcon(publicDir, 'favicon-48-v18.png', 48);
  await makeTransparentIcon(publicDir, 'favicon-192-v18.png', 192);
  await makeTransparentIcon(publicDir, 'favicon-512-v18.png', 512);
  await makeTransparentIcon(publicDir, 'favicon-48.png', 48);
  await makeTransparentIcon(publicDir, 'favicon-192.png', 192);
  
  // B. 苹果主屏幕图标 (淡黄色背景 #FFFBE6)
  await makeSolidBgIcon(publicDir, 'apple-touch-icon-v18.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSolidBgIcon(publicDir, 'apple-touch-icon.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSolidBgIcon(publicDir, 'apple-touch-icon-v15.png', 180, 140, { r: 255, g: 251, b: 230, alpha: 1 });

  // C. PWA Maskable 图标 (淡黄色背景 #FFFBE6)
  await makeSolidBgIcon(publicDir, 'favicon-maskable-192-v18.png', 192, 150, { r: 255, g: 251, b: 230, alpha: 1 });
  await makeSolidBgIcon(publicDir, 'favicon-maskable-512-v18.png', 512, 400, { r: 255, g: 251, b: 230, alpha: 1 });

  // --- Expo 移动端目标生成 ---
  // A. iOS 主应用图标 (浅蓝色背景 #E6F4FE)
  await makeSolidBgIcon(mobileDir, 'icon.png', 1024, 680, { r: 230, g: 244, b: 254, alpha: 1 });

  // B. Android 自适应前景图标 (透明)
  await makeSolidBgIcon(mobileDir, 'android-icon-foreground.png', 1024, 680, { r: 255, g: 255, b: 255, alpha: 0 });

  // C. Android 自适应背景图 (纯浅蓝色 #E6F4FE)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 230, g: 244, b: 254, alpha: 1 }
    }
  })
  .png({ palette: true, quality: 90 })
  .toFile(path.join(mobileDir, 'android-icon-background.png'));
  console.log(`Generated solid bg icon background: android-icon-background.png`);

  // D. 启动图 Splash 图标 (透明)
  await makeTransparentIcon(mobileDir, 'splash-icon.png', 200);

  // E. 移动端 Favicon
  await makeTransparentIcon(mobileDir, 'favicon.png', 48);

  console.log('All custom icons generated and replaced successfully from favicon-512-v15.png!');
}

main().catch(console.error);
